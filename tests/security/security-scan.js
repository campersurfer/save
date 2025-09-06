#!/usr/bin/env node

/**
 * Security Scanning and Vulnerability Assessment
 * Comprehensive security testing for Save App
 */

const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class SecurityScanner {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3001',
      frontendUrl: config.frontendUrl || 'http://localhost:3000',
      timeout: config.timeout || 30000,
      outputDir: config.outputDir || './security-reports',
      ...config
    };
    
    this.vulnerabilities = [];
    this.securityChecks = [];
    
    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  async runSecurityScan() {
    console.log('🔒 Starting Security Scan...');
    console.log(`Target: ${this.config.baseUrl}`);
    console.log(`Frontend: ${this.config.frontendUrl}`);
    
    try {
      await this.checkSSLTLS();
      await this.checkSecurityHeaders();
      await this.checkAuthenticationSecurity();
      await this.checkInputValidation();
      await this.checkCSRFProtection();
      await this.checkRateLimiting();
      await this.checkInformationDisclosure();
      await this.checkDependencyVulnerabilities();
      await this.checkContainerSecurity();
      await this.performOWASPTopTenChecks();
      
      this.generateReport();
      
    } catch (error) {
      console.error('Security scan failed:', error);
    }
  }

  async checkSSLTLS() {
    console.log('🔐 Checking SSL/TLS Configuration...');
    
    const httpsUrl = this.config.baseUrl.replace('http://', 'https://');
    
    try {
      const response = await this.makeRequest(httpsUrl);
      
      if (response.socket && response.socket.getPeerCertificate) {
        const cert = response.socket.getPeerCertificate();
        
        const tlsCheck = {
          name: 'TLS Certificate',
          status: 'pass',
          details: {
            subject: cert.subject,
            issuer: cert.issuer,
            valid_from: cert.valid_from,
            valid_to: cert.valid_to,
            protocol: response.socket.getProtocol()
          }
        };
        
        // Check certificate expiration
        const expiryDate = new Date(cert.valid_to);
        const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        
        if (expiryDate < thirtyDaysFromNow) {
          tlsCheck.status = 'warning';
          tlsCheck.message = 'Certificate expires within 30 days';
        }
        
        this.securityChecks.push(tlsCheck);
      }
      
    } catch (error) {
      this.vulnerabilities.push({
        type: 'SSL/TLS Configuration',
        severity: 'high',
        description: 'HTTPS not properly configured',
        details: error.message,
        recommendation: 'Configure SSL/TLS with valid certificates'
      });
    }
  }

  async checkSecurityHeaders() {
    console.log('🛡️ Checking Security Headers...');
    
    const urls = [
      this.config.baseUrl,
      this.config.frontendUrl,
      `${this.config.baseUrl}/api/health`
    ];
    
    for (const url of urls) {
      try {
        const response = await this.makeRequest(url);
        const headers = response.headers;
        
        // Required security headers
        const requiredHeaders = {
          'strict-transport-security': 'HSTS',
          'x-frame-options': 'Clickjacking Protection',
          'x-content-type-options': 'MIME Type Sniffing',
          'x-xss-protection': 'XSS Protection',
          'content-security-policy': 'CSP',
          'referrer-policy': 'Referrer Policy'
        };
        
        Object.entries(requiredHeaders).forEach(([header, name]) => {
          if (!headers[header]) {
            this.vulnerabilities.push({
              type: 'Missing Security Header',
              severity: 'medium',
              description: `Missing ${name} header`,
              url: url,
              recommendation: `Add ${header} security header`
            });
          } else {
            this.securityChecks.push({
              name: `${name} Header`,
              status: 'pass',
              url: url,
              value: headers[header]
            });
          }
        });
        
        // Check for information disclosure in headers
        const sensitiveHeaders = ['server', 'x-powered-by', 'x-aspnet-version'];
        sensitiveHeaders.forEach(header => {
          if (headers[header]) {
            this.vulnerabilities.push({
              type: 'Information Disclosure',
              severity: 'low',
              description: `Server information disclosed in ${header} header`,
              url: url,
              value: headers[header],
              recommendation: `Remove or obfuscate ${header} header`
            });
          }
        });
        
      } catch (error) {
        console.warn(`Failed to check headers for ${url}:`, error.message);
      }
    }
  }

  async checkAuthenticationSecurity() {
    console.log('🔑 Checking Authentication Security...');
    
    // Test for common authentication vulnerabilities
    const authTests = [
      {
        name: 'SQL Injection in Login',
        payload: { username: "admin'--", password: "password" },
        endpoint: '/api/auth/login'
      },
      {
        name: 'Brute Force Protection',
        payload: { username: 'admin', password: 'wrong' },
        endpoint: '/api/auth/login',
        repeat: 10
      },
      {
        name: 'JWT Token Validation',
        endpoint: '/api/protected',
        headers: { Authorization: 'Bearer invalid.jwt.token' }
      }
    ];
    
    for (const test of authTests) {
      try {
        if (test.repeat) {
          // Test rate limiting
          const attempts = Array.from({ length: test.repeat }, () => 
            this.makeRequest(`${this.config.baseUrl}${test.endpoint}`, {
              method: 'POST',
              body: JSON.stringify(test.payload),
              headers: { 'Content-Type': 'application/json' }
            })
          );
          
          const responses = await Promise.all(attempts);
          const rateLimited = responses.some(r => r.statusCode === 429);
          
          if (!rateLimited) {
            this.vulnerabilities.push({
              type: 'Brute Force Vulnerability',
              severity: 'high',
              description: 'No rate limiting on authentication endpoint',
              endpoint: test.endpoint,
              recommendation: 'Implement rate limiting for authentication attempts'
            });
          } else {
            this.securityChecks.push({
              name: 'Brute Force Protection',
              status: 'pass',
              endpoint: test.endpoint
            });
          }
          
        } else {
          const response = await this.makeRequest(`${this.config.baseUrl}${test.endpoint}`, {
            method: 'POST',
            body: test.payload ? JSON.stringify(test.payload) : undefined,
            headers: {
              'Content-Type': 'application/json',
              ...test.headers
            }
          });
          
          // Check for SQL injection indicators
          if (test.name.includes('SQL') && response.body) {
            const sqlErrors = [
              'sql syntax',
              'mysql_fetch',
              'ora-',
              'microsoft ole db',
              'sqlite3'
            ];
            
            const hasError = sqlErrors.some(error => 
              response.body.toLowerCase().includes(error)
            );
            
            if (hasError) {
              this.vulnerabilities.push({
                type: 'SQL Injection',
                severity: 'critical',
                description: 'SQL injection vulnerability detected',
                endpoint: test.endpoint,
                recommendation: 'Use parameterized queries and input validation'
              });
            }
          }
        }
        
      } catch (error) {
        console.warn(`Auth test failed: ${test.name}`, error.message);
      }
    }
  }

  async checkInputValidation() {
    console.log('🎯 Checking Input Validation...');
    
    const payloads = [
      { name: 'XSS', value: '<script>alert("XSS")</script>' },
      { name: 'SQL Injection', value: "1' OR '1'='1" },
      { name: 'Command Injection', value: '; cat /etc/passwd' },
      { name: 'Path Traversal', value: '../../../etc/passwd' },
      { name: 'XXE', value: '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>' }
    ];
    
    const endpoints = [
      { url: '/api/extract', method: 'POST', field: 'url' },
      { url: '/api/search', method: 'GET', field: 'q' },
      { url: '/api/users', method: 'POST', field: 'name' }
    ];
    
    for (const endpoint of endpoints) {
      for (const payload of payloads) {
        try {
          let response;
          
          if (endpoint.method === 'GET') {
            const url = `${this.config.baseUrl}${endpoint.url}?${endpoint.field}=${encodeURIComponent(payload.value)}`;
            response = await this.makeRequest(url);
          } else {
            const body = { [endpoint.field]: payload.value };
            response = await this.makeRequest(`${this.config.baseUrl}${endpoint.url}`, {
              method: endpoint.method,
              body: JSON.stringify(body),
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          // Check if payload is reflected in response
          if (response.body && response.body.includes(payload.value)) {
            this.vulnerabilities.push({
              type: `${payload.name} Vulnerability`,
              severity: payload.name === 'XSS' ? 'high' : 'critical',
              description: `Unvalidated input reflected in response`,
              endpoint: endpoint.url,
              payload: payload.value,
              recommendation: 'Implement proper input validation and output encoding'
            });
          }
          
        } catch (error) {
          // Request failures are expected for malicious payloads
        }
      }
    }
  }

  async checkCSRFProtection() {
    console.log('🛡️ Checking CSRF Protection...');
    
    const stateChangingEndpoints = [
      { url: '/api/extract', method: 'POST' },
      { url: '/api/users', method: 'POST' },
      { url: '/api/settings', method: 'PUT' }
    ];
    
    for (const endpoint of stateChangingEndpoints) {
      try {
        const response = await this.makeRequest(`${this.config.baseUrl}${endpoint.url}`, {
          method: endpoint.method,
          body: JSON.stringify({ test: 'csrf' }),
          headers: { 
            'Content-Type': 'application/json',
            'Origin': 'http://evil-site.com'
          }
        });
        
        // Check if request was accepted without CSRF protection
        if (response.statusCode < 400) {
          this.vulnerabilities.push({
            type: 'CSRF Vulnerability',
            severity: 'medium',
            description: 'State-changing endpoint lacks CSRF protection',
            endpoint: endpoint.url,
            recommendation: 'Implement CSRF tokens or SameSite cookies'
          });
        } else {
          this.securityChecks.push({
            name: 'CSRF Protection',
            status: 'pass',
            endpoint: endpoint.url
          });
        }
        
      } catch (error) {
        // Request failures might indicate CSRF protection is working
      }
    }
  }

  async checkRateLimiting() {
    console.log('⏱️ Checking Rate Limiting...');
    
    const endpoints = [
      '/api/extract',
      '/api/search', 
      '/api/auth/login'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const requests = Array.from({ length: 20 }, () =>
          this.makeRequest(`${this.config.baseUrl}${endpoint}`)
        );
        
        const responses = await Promise.all(requests.map(p => p.catch(e => ({ statusCode: 0, error: e }))));
        const rateLimitedCount = responses.filter(r => r.statusCode === 429).length;
        
        if (rateLimitedCount === 0) {
          this.vulnerabilities.push({
            type: 'Missing Rate Limiting',
            severity: 'medium',
            description: `No rate limiting detected on ${endpoint}`,
            endpoint: endpoint,
            recommendation: 'Implement rate limiting to prevent abuse'
          });
        } else {
          this.securityChecks.push({
            name: 'Rate Limiting',
            status: 'pass',
            endpoint: endpoint,
            details: `${rateLimitedCount}/20 requests rate limited`
          });
        }
        
      } catch (error) {
        console.warn(`Rate limiting check failed for ${endpoint}:`, error.message);
      }
    }
  }

  async checkInformationDisclosure() {
    console.log('🔍 Checking Information Disclosure...');
    
    const sensitiveEndpoints = [
      '/admin',
      '/.env',
      '/config.json',
      '/package.json',
      '/api/debug',
      '/api/metrics',
      '/health'
    ];
    
    for (const endpoint of sensitiveEndpoints) {
      try {
        const response = await this.makeRequest(`${this.config.baseUrl}${endpoint}`);
        
        if (response.statusCode === 200 && response.body) {
          // Check if response contains sensitive information
          const sensitivePatterns = [
            /password/i,
            /secret/i,
            /api[_-]?key/i,
            /private[_-]?key/i,
            /database/i,
            /connection[_-]?string/i
          ];
          
          const containsSensitive = sensitivePatterns.some(pattern =>
            pattern.test(response.body)
          );
          
          if (containsSensitive || endpoint.includes('.env') || endpoint.includes('config')) {
            this.vulnerabilities.push({
              type: 'Information Disclosure',
              severity: 'medium',
              description: `Sensitive information exposed at ${endpoint}`,
              endpoint: endpoint,
              recommendation: 'Restrict access to sensitive endpoints'
            });
          }
        }
        
      } catch (error) {
        // 404s are expected and good for sensitive endpoints
      }
    }
  }

  async checkDependencyVulnerabilities() {
    console.log('📦 Checking Dependency Vulnerabilities...');
    
    try {
      // Run npm audit if package.json exists
      if (fs.existsSync('package.json')) {
        const auditResult = await this.runCommand('npm audit --json');
        
        if (auditResult.stdout) {
          try {
            const audit = JSON.parse(auditResult.stdout);
            
            if (audit.vulnerabilities) {
              Object.entries(audit.vulnerabilities).forEach(([pkg, vuln]) => {
                this.vulnerabilities.push({
                  type: 'Dependency Vulnerability',
                  severity: vuln.severity || 'medium',
                  description: `Vulnerable dependency: ${pkg}`,
                  package: pkg,
                  details: vuln.via ? vuln.via.join(', ') : 'See npm audit for details',
                  recommendation: 'Update to patched version or find alternative'
                });
              });
            }
          } catch (parseError) {
            console.warn('Failed to parse npm audit output:', parseError.message);
          }
        }
      }
      
    } catch (error) {
      console.warn('Dependency vulnerability check failed:', error.message);
    }
  }

  async checkContainerSecurity() {
    console.log('🐳 Checking Container Security...');
    
    try {
      // Check if running in Docker
      if (fs.existsSync('/.dockerenv') || fs.existsSync('/proc/1/cgroup')) {
        // Check for common container misconfigurations
        const checks = [
          {
            name: 'Running as root',
            check: () => process.getuid && process.getuid() === 0,
            severity: 'high',
            recommendation: 'Run container as non-root user'
          },
          {
            name: 'Writable filesystem',
            check: () => {
              try {
                fs.writeFileSync('/tmp/security-test', 'test');
                fs.unlinkSync('/tmp/security-test');
                return true;
              } catch (e) {
                return false;
              }
            },
            severity: 'medium',
            recommendation: 'Use read-only filesystem where possible'
          }
        ];
        
        checks.forEach(check => {
          const result = check.check();
          if (result) {
            this.vulnerabilities.push({
              type: 'Container Security',
              severity: check.severity,
              description: check.name,
              recommendation: check.recommendation
            });
          }
        });
      }
      
    } catch (error) {
      console.warn('Container security check failed:', error.message);
    }
  }

  async performOWASPTopTenChecks() {
    console.log('🏆 Performing OWASP Top 10 Checks...');
    
    // This is a simplified version - in production, use dedicated security tools
    const owaspChecks = [
      { name: 'A01:2021 – Broken Access Control', status: 'requires_manual_testing' },
      { name: 'A02:2021 – Cryptographic Failures', status: 'partial' },
      { name: 'A03:2021 – Injection', status: 'tested' },
      { name: 'A04:2021 – Insecure Design', status: 'requires_manual_review' },
      { name: 'A05:2021 – Security Misconfiguration', status: 'tested' },
      { name: 'A06:2021 – Vulnerable Components', status: 'tested' },
      { name: 'A07:2021 – Identification and Authentication Failures', status: 'partial' },
      { name: 'A08:2021 – Software and Data Integrity Failures', status: 'requires_manual_testing' },
      { name: 'A09:2021 – Security Logging and Monitoring Failures', status: 'requires_manual_review' },
      { name: 'A10:2021 – Server-Side Request Forgery', status: 'requires_manual_testing' }
    ];
    
    this.securityChecks.push({
      name: 'OWASP Top 10 Assessment',
      status: 'info',
      details: owaspChecks
    });
  }

  generateReport() {
    console.log('\n📊 Generating Security Report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      target: {
        baseUrl: this.config.baseUrl,
        frontendUrl: this.config.frontendUrl
      },
      summary: {
        totalVulnerabilities: this.vulnerabilities.length,
        criticalVulnerabilities: this.vulnerabilities.filter(v => v.severity === 'critical').length,
        highVulnerabilities: this.vulnerabilities.filter(v => v.severity === 'high').length,
        mediumVulnerabilities: this.vulnerabilities.filter(v => v.severity === 'medium').length,
        lowVulnerabilities: this.vulnerabilities.filter(v => v.severity === 'low').length,
        securityChecksPass: this.securityChecks.filter(c => c.status === 'pass').length,
        securityChecksTotal: this.securityChecks.length
      },
      vulnerabilities: this.vulnerabilities,
      securityChecks: this.securityChecks
    };
    
    // Save JSON report
    const jsonReportPath = path.join(this.config.outputDir, `security-report-${Date.now()}.json`);
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
    
    // Generate markdown report
    this.generateMarkdownReport(report);
    
    // Print summary
    console.log('\n🔒 Security Scan Summary:');
    console.log('=======================');
    console.log(`Critical Vulnerabilities: ${report.summary.criticalVulnerabilities}`);
    console.log(`High Vulnerabilities: ${report.summary.highVulnerabilities}`);
    console.log(`Medium Vulnerabilities: ${report.summary.mediumVulnerabilities}`);
    console.log(`Low Vulnerabilities: ${report.summary.lowVulnerabilities}`);
    console.log(`Security Checks Passed: ${report.summary.securityChecksPass}/${report.summary.securityChecksTotal}`);
    console.log(`\nDetailed report saved to: ${jsonReportPath}`);
    
    return report;
  }

  generateMarkdownReport(report) {
    const mdReportPath = path.join(this.config.outputDir, `security-report-${Date.now()}.md`);
    
    let markdown = `# Security Scan Report\n\n`;
    markdown += `**Date:** ${report.timestamp}\n`;
    markdown += `**Target:** ${report.target.baseUrl}\n`;
    markdown += `**Frontend:** ${report.target.frontendUrl}\n\n`;
    
    markdown += `## Summary\n\n`;
    markdown += `- **Total Vulnerabilities:** ${report.summary.totalVulnerabilities}\n`;
    markdown += `- **Critical:** ${report.summary.criticalVulnerabilities}\n`;
    markdown += `- **High:** ${report.summary.highVulnerabilities}\n`;
    markdown += `- **Medium:** ${report.summary.mediumVulnerabilities}\n`;
    markdown += `- **Low:** ${report.summary.lowVulnerabilities}\n`;
    markdown += `- **Security Checks Passed:** ${report.summary.securityChecksPass}/${report.summary.securityChecksTotal}\n\n`;
    
    if (report.vulnerabilities.length > 0) {
      markdown += `## Vulnerabilities\n\n`;
      
      ['critical', 'high', 'medium', 'low'].forEach(severity => {
        const vulns = report.vulnerabilities.filter(v => v.severity === severity);
        if (vulns.length > 0) {
          markdown += `### ${severity.toUpperCase()} Severity\n\n`;
          vulns.forEach(vuln => {
            markdown += `#### ${vuln.type}\n`;
            markdown += `- **Description:** ${vuln.description}\n`;
            if (vuln.endpoint) markdown += `- **Endpoint:** ${vuln.endpoint}\n`;
            if (vuln.recommendation) markdown += `- **Recommendation:** ${vuln.recommendation}\n`;
            markdown += `\n`;
          });
        }
      });
    }
    
    markdown += `## Security Checks\n\n`;
    report.securityChecks.forEach(check => {
      markdown += `- **${check.name}:** ${check.status}\n`;
      if (check.details) markdown += `  - ${check.details}\n`;
    });
    
    fs.writeFileSync(mdReportPath, markdown);
  }

  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: this.config.timeout
      };
      
      const req = client.request(requestOptions, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
            socket: res.socket
          });
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }

  async runCommand(command) {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, { stdio: 'pipe' });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', data => stdout += data);
      child.stderr.on('data', data => stderr += data);
      
      child.on('close', code => {
        resolve({ code, stdout, stderr });
      });
      
      child.on('error', reject);
    });
  }
}

// CLI interface
if (require.main === module) {
  const config = {
    baseUrl: process.env.SECURITY_SCAN_URL || 'http://localhost:3001',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    outputDir: process.env.OUTPUT_DIR || './security-reports'
  };
  
  const scanner = new SecurityScanner(config);
  scanner.runSecurityScan().catch(console.error);
}

module.exports = SecurityScanner;