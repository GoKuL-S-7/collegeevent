const axios = require('axios');
const cheerio = require('cheerio');
const ipLib = require('ip');
const dns = require('dns').promises;
const SuspiciousActivity = require('../models/SuspiciousActivity');
const User = require('../models/User');

const SCORING = {
  VPN_LOGIN: 30,
  UNUSUAL_LOCATION_LOGIN: 30,
  BRUTE_FORCE_ATTEMPT: 20,
  BOT_LIKE_ACTIVITY: 25,
  BULK_REGISTRATION: 25,
  MALICIOUS_LINK_DETECTION: 40,
  API_ABUSE: 25,
  TRUST_ANALYSIS_FLAG: 35
};

const TRUSTED_DOMAINS = [
  'gov.in', 'edu.in', 'ac.in', 'res.in', 'nic.in', 'ernet.in',
  'google.com', 'forms.gle', 'microsoft.com', 'outlook.com',
  'github.com', 'eventbrite.com', 'townscript.com', 'unstop.com',
  'iitm.ac.in', 'annauniv.edu', 'nptel.ac.in', 'vit.ac.in', 'bits-pilani.ac.in'
];

const BRAND_KNOWLEDGE = {
  'SIH': { name: 'Smart India Hackathon', trustedDomain: 'gov.in' },
  'IITM': { name: 'IIT Madras', trustedDomain: 'iitm.ac.in' },
  'AU': { name: 'Anna University', trustedDomain: 'annauniv.edu' },
  'NPTEL': { name: 'NPTEL', trustedDomain: 'nptel.ac.in' },
  'IIT': { name: 'Indian Institute of Technology', trustedDomain: 'ac.in' },
  'NIT': { name: 'National Institute of Technology', trustedDomain: 'ac.in' }
};

const OFFICIAL_KEYWORDS = [
  'government', 'ministry', 'department', 'official', 'portal', 'digitalindia', 'smartindia'
];

const SUSPICIOUS_TLDS = ['.xyz', '.top', '.click', '.buzz', '.online', '.site', '.work', '.info', '.live', '.space', '.net', '.org'];

const getLocationInfo = async (ip) => {
  try {
    if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return { city: 'Localhost', country: 'Local', isVPN: false };
    }
    const response = await axios.get(`https://ipapi.co/${ip}/json/`);
    if (response.data) {
      return {
        city: response.data.city || 'Unknown',
        country: response.data.country_name || 'Unknown',
        isVPN: response.data.proxy || false
      };
    }
  } catch (error) {}
  return { city: 'Unknown', country: 'Unknown', isVPN: false };
};

const getRiskLevel = (score) => {
  if (score < 30) return 'Normal';
  if (score <= 60) return 'Warning';
  return 'Critical';
};

const validateSafeURL = async (url) => {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return false;

    // Resolve DNS to check real IP
    const addresses = await dns.resolve4(hostname).catch(() => []);
    if (addresses.length === 0) return true; // Might be valid but unreachable now

    for (const addr of addresses) {
      if (ipLib.isPrivate(addr) || ipLib.isLoopback(addr)) {
        return false;
      }
    }
    return true;
  } catch (e) {
    return false;
  }
};

const analyzeWebpageContent = async (url) => {
  const isSafe = await validateSafeURL(url);
  if (!isSafe) {
    return { status: 'INVALID DOMAIN', classification: 'SECURITY PROTECTION BLOCK', anomalyScore: 50, reasons: ['Internal or restricted IP access blocked (SSRF Protection)'] };
  }

  let redirectCount = 0;
  let finalUrl = url;

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 CampusConnect-Validator/2.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
      },
      maxRedirects: 10,
      validateStatus: (status) => status < 500,
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.loaded > 2 * 1024 * 1024) { // Limit to 2MB
          throw new Error('PAGE TOO LARGE');
        }
      }
    });

    finalUrl = response.request.res.responseUrl || url;
    redirectCount = response.request._redirectable ? response.request._redirectable._redirectCount : 0;

    if (response.status === 404) {
      return { status: 'PAGE NOT FOUND', classification: 'BROKEN LINK', anomalyScore: 40, reasons: ['Registration link returns 404 Not Found'], redirectCount, finalUrl };
    }

    if (redirectCount > 5) {
      return { status: 'REDIRECT LOOP', classification: 'SUSPICIOUS REDIRECTS', anomalyScore: 40, reasons: [`Excessive redirects detected (${redirectCount} hops)`], redirectCount, finalUrl };
    }

    const html = response.data;
    if (typeof html !== 'string' || html.length < 100) {
      return { status: 'BROKEN LINK', classification: 'INVALID CONTENT', anomalyScore: 35, reasons: ['Webpage content is empty or unreadable'], redirectCount, finalUrl };
    }

    const $ = cheerio.load(html);
    const title = $('title').text().trim() || 'No Title';
    const bodyText = $('body').text().toLowerCase();
    
    let relevanceScore = 0;
    let suspicionScore = 0;
    const reasons = [];

    // 1. Form Detection (REAL Analysis)
    const forms = $('form');
    const inputs = $('input');
    const hasRegistrationForm = forms.length > 0 && (
      bodyText.includes('register') || bodyText.includes('apply') || bodyText.includes('sign up') ||
      inputs.filter((i, el) => $(el).attr('name')?.toLowerCase().includes('name') || $(el).attr('placeholder')?.toLowerCase().includes('college')).length > 0
    );

    if (hasRegistrationForm) {
      relevanceScore += 40;
      reasons.push('Active registration form detected');
    }

    // 2. Keyword Relevance
    const validKeywords = ['participant', 'team', 'hackathon', 'workshop', 'seminar', 'event date', 'venue', 'organized by', 'college', 'university'];
    validKeywords.forEach(k => {
      if (bodyText.includes(k)) relevanceScore += 10;
    });

    // 3. Phishing/Spam Detection
    const spamKeywords = ['casino', 'betting', 'crypto', 'giveaway', 'free money', 'win prize', 'lottery', 'invest', 'adult'];
    spamKeywords.forEach(k => {
      if (bodyText.includes(k)) {
        suspicionScore += 30;
        reasons.push(`Spam/Unrelated content detected: ${k}`);
      }
    });

    // 4. Fake Login Detection
    const isLoginOnly = $('input[type="password"]').length > 0 && relevanceScore < 20;
    if (isLoginOnly) {
      suspicionScore += 40;
      reasons.push('Suspicious login-only page detected (Possible Phishing)');
    }

    // 5. Classification Engine
    let classification = 'UNRELATED WEBPAGE';
    if (suspicionScore > 50 || isLoginOnly) classification = 'PHISHING PAGE';
    else if (suspicionScore > 20) classification = 'SPAM CONTENT';
    else if (relevanceScore >= 50) classification = 'EVENT REGISTRATION FORM';
    else if (relevanceScore >= 30) classification = 'VALID EVENT PAGE';

    return {
      status: 'LOADED',
      classification,
      scannedTitle: title,
      eventRelevanceScore: Math.min(100, relevanceScore),
      anomalyScore: suspicionScore,
      reasons,
      redirectCount,
      finalUrl
    };

  } catch (error) {
    let status = 'UNREACHABLE WEBSITE';
    let classification = 'BROKEN LINK';
    let reason = error.message;

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      status = 'TIMEOUT ERROR';
      classification = 'UNREACHABLE';
    } else if (error.code === 'ENOTFOUND') {
      status = 'INVALID DOMAIN';
      classification = 'DNS FAILURE';
    } else if (error.message === 'PAGE TOO LARGE') {
      status = 'INVALID CONTENT';
      classification = 'PAYLOAD TOO LARGE';
    }

    return { status, classification, anomalyScore: 40, reasons: [`Network Validation Failed: ${status} (${reason})`], redirectCount, finalUrl };
  }
};

const analyzeEventTrust = async (eventTitle, organizerName, submittedUrl) => {
  let trustScore = 100;
  let anomalyScore = 0;
  const suspicionReasons = [];
  let matchedBrand = null;
  
  // 1. REAL Webpage Fetching and Analysis (The Core Layer)
  const webAnalysis = await analyzeWebpageContent(submittedUrl);
  const finalUrl = webAnalysis.finalUrl || submittedUrl;
  
  if (webAnalysis.classification === 'PHISHING PAGE' || 
      webAnalysis.classification === 'SPAM CONTENT' || 
      webAnalysis.classification === 'BROKEN LINK' ||
      webAnalysis.classification === 'SECURITY PROTECTION BLOCK' ||
      webAnalysis.classification === 'UNRELATED WEBPAGE' ||
      webAnalysis.status === 'INVALID DOMAIN' ||
      (webAnalysis.eventRelevanceScore !== undefined && webAnalysis.eventRelevanceScore < 30)) {
    
    // Add anomaly points for irrelevance if not already high
    if (webAnalysis.classification === 'UNRELATED WEBPAGE' || webAnalysis.eventRelevanceScore < 30) {
      anomalyScore += 25;
      suspicionReasons.push(`Webpage content has low relevance to event registration (${webAnalysis.eventRelevanceScore}% match)`);
    } else {
      anomalyScore += webAnalysis.anomalyScore;
    }
    
    if (webAnalysis.reasons) suspicionReasons.push(...webAnalysis.reasons);
  }

  const urlObj = new URL(finalUrl);
  const domain = urlObj.hostname.toLowerCase();
  const domainParts = domain.split('.');
  const tld = '.' + domainParts[domainParts.length - 1];
  const primaryDomain = domainParts[domainParts.length - 2] || '';

  const titleLower = eventTitle.toLowerCase();
  const orgLower = organizerName.toLowerCase();
  const domainLower = domain.toLowerCase();

  // 2. Brand Knowledge & Acronym Detection
  for (const [acronym, brand] of Object.entries(BRAND_KNOWLEDGE)) {
    const acronymLower = acronym.toLowerCase();
    const brandNameLower = brand.name.toLowerCase();
    
    const isTitleMatch = titleLower.includes(acronymLower) || titleLower.includes(brandNameLower);
    const isOrgMatch = orgLower.includes(acronymLower) || orgLower.includes(brandNameLower);
    const isDomainMatch = domainLower.includes(acronymLower) || domainLower.includes(brandNameLower.replace(/\s/g, ''));

    if ((isTitleMatch || isOrgMatch) && isDomainMatch) {
      matchedBrand = brand.name;
      const isTrustedDomain = domain.endsWith(brand.trustedDomain);
      
      if (!isTrustedDomain) {
        anomalyScore += 20;
        trustScore -= 25;
        suspicionReasons.push(`Unofficial domain used for ${brand.name} branding`);
        
        if (domainLower.includes(acronymLower)) {
          anomalyScore += 20;
          trustScore -= 20;
          suspicionReasons.push(`Domain uses the institutional acronym "${acronym}" without authorization`);
        }
      }
    }
  }

  // 3. Government Event Imitation
  const isGovEvent = OFFICIAL_KEYWORDS.some(k => titleLower.includes(k) || orgLower.includes(k)) || 
                    titleLower.includes('smart india') || titleLower.includes('digital india');
  
  if (isGovEvent && !domain.endsWith('.gov.in') && !domain.endsWith('.nic.in')) {
    const isTrusted = TRUSTED_DOMAINS.some(d => domain.endsWith(d));
    if (!isTrusted) {
      anomalyScore += 25;
      trustScore -= 30;
      suspicionReasons.push('Government-style event imitation on unofficial domain');
    }
  }

  // 4. Unofficial Domain Extension
  if (anomalyScore > 0 && SUSPICIOUS_TLDS.includes(tld)) {
    anomalyScore += 15;
    trustScore -= 15;
    suspicionReasons.push(`Unofficial domain extension (${tld}) used for official branding`);
  }

  return {
    finalUrl,
    trustScore: Math.max(0, trustScore),
    anomalyScore,
    suspicionReasons,
    matchedBrand,
    webAnalysis,
    domainReputation: anomalyScore > 50 ? 'Low/Dangerous' : (anomalyScore > 30 ? 'Suspicious' : 'Neutral'),
    riskLevel: anomalyScore > 60 ? 'Critical' : (anomalyScore > 30 ? 'Warning' : 'Normal')
  };
};

const logSuspiciousActivity = async (data) => {
  const { username, activityType, ipAddress, location, metadata, additionalScore = 0, eventDetails } = data;
  
  const baseScore = SCORING[activityType] || 0;
  const totalScore = baseScore + additionalScore;
  const riskLevel = getRiskLevel(totalScore);

  const activity = new SuspiciousActivity({
    username,
    activityType,
    ipAddress,
    location,
    anomalyScore: totalScore,
    riskLevel,
    metadata,
    ...eventDetails
  });

  await activity.save();

  if (riskLevel === 'Critical') {
    await User.findOneAndUpdate({ username }, { isSuspicious: true });
  }

  return activity;
};

const isMaliciousLink = (url) => {
  const maliciousPatterns = [
    /bitly\.com\/malicious/i, /phishing/i, /scam/i, /malware/i, /free-money/i, /adult-content/i
  ];
  const blacklist = ['malicious-site.com', 'scam-events.org', 'phish-login.net'];
  try {
    const domain = new URL(url).hostname;
    if (blacklist.includes(domain)) return true;
  } catch (e) {}
  return maliciousPatterns.some(pattern => pattern.test(url));
};

module.exports = {
  getLocationInfo,
  logSuspiciousActivity,
  isMaliciousLink,
  analyzeEventTrust,
  expandURLChain: async (url) => (await analyzeWebpageContent(url)).finalUrl,
  SCORING
};
