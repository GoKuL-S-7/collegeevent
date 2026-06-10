const tls = require('tls');

function checkSslCertificate(hostname, port = 443) {
  return new Promise((resolve) => {
    let resolved = false;
    const socket = tls.connect({
      host: hostname,
      port: port,
      servername: hostname, // SNI
      rejectUnauthorized: false
    }, () => {
      if (resolved) return;
      resolved = true;
      const cert = socket.getPeerCertificate(true);
      socket.end();
      if (!cert || Object.keys(cert).length === 0) {
        resolve({ exists: false, valid: false, reason: 'No peer certificate returned' });
        return;
      }
      
      const now = Date.now();
      const validFrom = new Date(cert.valid_from).getTime();
      const validTo = new Date(cert.valid_to).getTime();
      const isExpired = now < validFrom || now > validTo;
      
      let domainMatches = false;
      const certSubject = cert.subject;
      const cn = certSubject ? certSubject.CN : null;
      const altNames = cert.subjectaltname ? cert.subjectaltname.split(', ').map(n => n.replace('DNS:', '')) : [];
      
      const matchPattern = (pattern, name) => {
        if (!pattern) return false;
        const pat = pattern.toLowerCase();
        const nam = name.toLowerCase();
        if (pat === nam) return true;
        if (pat.startsWith('*.')) {
          const suffix = pat.substring(2);
          return nam.endsWith(suffix) && nam.split('.').length === pat.split('.').length;
        }
        return false;
      };
      
      if (matchPattern(cn, hostname)) {
        domainMatches = true;
      } else {
        for (const alt of altNames) {
          if (matchPattern(alt, hostname)) {
            domainMatches = true;
            break;
          }
        }
      }
      
      const valid = !isExpired && domainMatches;
      resolve({ exists: true, valid, isExpired, domainMatches });
    });
    
    socket.on('error', (err) => {
      if (resolved) return;
      resolved = true;
      resolve({ exists: false, valid: false, reason: err.message });
    });
    
    // Safety timeout of 4s
    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({ exists: false, valid: false, reason: 'TLS handshake timeout' });
    }, 4000);
  });
}

module.exports = checkSslCertificate;
