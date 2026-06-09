function getClientIp(req) {
  if (!req) return '127.0.0.1';

  // Always prefer x-forwarded-for when running behind proxy/Railway
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    // Filter out internal/private/CGNAT IPs to find the first public IP
    for (const rawIp of ips) {
      const ip = rawIp.replace(/^::ffff:/, '');
      if (ip && !isPrivateOrInternalIp(ip)) {
        return ip;
      }
    }
    // If all are private/internal, return the first one
    return ips[0].replace(/^::ffff:/, '');
  }

  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp) {
    const ip = xRealIp.replace(/^::ffff:/, '').trim();
    if (!isPrivateOrInternalIp(ip)) {
      return ip;
    }
  }

  let remoteAddress = req.socket?.remoteAddress || req.connection?.remoteAddress;
  if (remoteAddress) {
    return remoteAddress.replace(/^::ffff:/, '').trim();
  }

  return '127.0.0.1';
}

function isPrivateOrInternalIp(ip) {
  if (ip === '::1' || ip === '127.0.0.1') return true;
  
  // 10.0.0.0 - 10.255.255.255
  if (/^10\./.test(ip)) return true;
  
  // 192.168.0.0 - 192.168.255.255
  if (/^192\.168\./.test(ip)) return true;
  
  // 172.16.0.0 - 172.31.255.255
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  
  // 100.64.0.0 - 100.127.255.255 (CGNAT / Shared Address Space)
  if (/^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(ip)) return true;
  
  return false;
}

module.exports = { getClientIp, isPrivateOrInternalIp };
