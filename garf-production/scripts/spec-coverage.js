#!/usr/bin/env node

/**
 * Spec Kit Coverage Analyzer
 * Checks implementation coverage against specifications
 */

const fs = require('fs');
const path = require('path');

const SPECS_DIR = path.join(__dirname, '..', 'specs');
const SOURCE_DIRS = [
  path.join(__dirname, '..'),
  path.join(__dirname, '..', 'api'),
  path.join(__dirname, '..', 'src')
];

/**
 * Extract requirements from specification
 */
function extractRequirements(specPath) {
  const content = fs.readFileSync(specPath, 'utf-8');
  const requirements = [];
  const lines = content.split('\n');
  
  let inRequirements = false;
  
  for (const line of lines) {
    if (line.startsWith('## Requirements')) {
      inRequirements = true;
    } else if (line.startsWith('## ') && inRequirements) {
      inRequirements = false;
    } else if (inRequirements && line.trim().match(/^\d+\./)) {
      const req = line.trim().replace(/^\d+\.\s*/, '').replace(/\*\*/g, '');
      requirements.push(req);
    }
  }
  
  return requirements;
}

/**
 * Search for implementation of a requirement
 */
function findImplementation(requirement, sourceDirs) {
  const keywords = extractKeywords(requirement);
  const implementations = [];
  
  for (const dir of sourceDirs) {
    if (!fs.existsSync(dir)) continue;
    
    const files = walkDir(dir);
    
    for (const file of files) {
      if (shouldSkipFile(file)) continue;
      
      const content = fs.readFileSync(file, 'utf-8');
      const matches = countKeywordMatches(content, keywords);
      
      if (matches > keywords.length * 0.5) {
        implementations.push({
          file: path.relative(process.cwd(), file),
          matches,
          confidence: matches / keywords.length
        });
      }
    }
  }
  
  return implementations.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Extract keywords from requirement text
 */
function extractKeywords(text) {
  // Extract function names, class names, and key terms
  const keywords = [];
  
  // Function/method names (camelCase or PascalCase)
  const funcMatches = text.match(/\b[a-z][a-zA-Z0-9]*(?:\(\))?/g) || [];
  keywords.push(...funcMatches.map(k => k.replace('()', '')));
  
  // Key technical terms
  const technicalTerms = [
    'kosher', 'age', 'band', 'allergy', 'diet', 'score', 'group',
    'participant', 'run', 'build', 'filter', 'validate', 'persist'
  ];
  
  for (const term of technicalTerms) {
    if (text.toLowerCase().includes(term)) {
      keywords.push(term);
    }
  }
  
  return [...new Set(keywords)]; // Remove duplicates
}

/**
 * Count keyword matches in content
 */
function countKeywordMatches(content, keywords) {
  let matches = 0;
  const lowerContent = content.toLowerCase();
  
  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'g');
    const keywordMatches = (lowerContent.match(regex) || []).length;
    if (keywordMatches > 0) {
      matches++;
    }
  }
  
  return matches;
}

/**
 * Recursively walk directory
 */
function walkDir(dir) {
  const files = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !shouldSkipDir(item)) {
        files.push(...walkDir(fullPath));
      } else if (stat.isFile()) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Ignore permission errors
  }
  
  return files;
}

/**
 * Check if directory should be skipped
 */
function shouldSkipDir(dirName) {
  const skipDirs = [
    'node_modules', '.git', 'dist', 'build', 'coverage',
    '.next', '.cache', 'tmp', 'temp', 'specs', 'github-issues'
  ];
  
  return skipDirs.includes(dirName);
}

/**
 * Check if file should be skipped
 */
function shouldSkipFile(filePath) {
  const skipExtensions = [
    '.md', '.json', '.lock', '.log', '.txt',
    '.png', '.jpg', '.svg', '.ico', '.css'
  ];
  
  const skipPatterns = [
    'test.ts', 'spec.ts', 'test.js', 'spec.js',
    '.d.ts', 'config.', 'README'
  ];
  
  const ext = path.extname(filePath);
  const basename = path.basename(filePath);
  
  if (skipExtensions.includes(ext)) return true;
  
  for (const pattern of skipPatterns) {
    if (basename.includes(pattern)) return true;
  }
  
  return false;
}

/**
 * Generate coverage report
 */
function generateReport(coverage) {
  console.log('\n📊 Specification Coverage Report\n');
  console.log('=' .repeat(60));
  
  let totalRequirements = 0;
  let implementedRequirements = 0;
  
  for (const spec of coverage) {
    console.log(`\n📄 ${spec.name}`);
    console.log('-'.repeat(40));
    
    totalRequirements += spec.requirements.length;
    
    for (const req of spec.requirements) {
      const status = req.implemented ? '✅' : '❌';
      const confidence = req.implementations.length > 0 
        ? ` (${Math.round(req.implementations[0].confidence * 100)}% confidence)`
        : '';
      
      console.log(`${status} ${req.text.substring(0, 60)}...${confidence}`);
      
      if (req.implemented) {
        implementedRequirements++;
        if (req.implementations.length > 0) {
          console.log(`   📁 ${req.implementations[0].file}`);
        }
      }
    }
    
    const specCoverage = spec.requirements.filter(r => r.implemented).length;
    const specPercentage = Math.round((specCoverage / spec.requirements.length) * 100);
    console.log(`\n   Coverage: ${specCoverage}/${spec.requirements.length} (${specPercentage}%)`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📈 Overall Coverage Summary');
  console.log('='.repeat(60));
  
  const overallPercentage = Math.round((implementedRequirements / totalRequirements) * 100);
  
  console.log(`Total Requirements: ${totalRequirements}`);
  console.log(`Implemented: ${implementedRequirements}`);
  console.log(`Not Implemented: ${totalRequirements - implementedRequirements}`);
  console.log(`Coverage: ${overallPercentage}%`);
  
  // Coverage grade
  let grade = 'F';
  if (overallPercentage >= 90) grade = 'A';
  else if (overallPercentage >= 80) grade = 'B';
  else if (overallPercentage >= 70) grade = 'C';
  else if (overallPercentage >= 60) grade = 'D';
  
  console.log(`Grade: ${grade}`);
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  if (overallPercentage < 80) {
    console.log('- Coverage is below 80%. Consider implementing missing requirements.');
  }
  if (totalRequirements - implementedRequirements > 5) {
    console.log(`- ${totalRequirements - implementedRequirements} requirements need implementation.`);
  }
  
  return {
    total: totalRequirements,
    implemented: implementedRequirements,
    percentage: overallPercentage,
    grade
  };
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Analyzing specification coverage...\n');
  
  const specFiles = fs.readdirSync(SPECS_DIR)
    .filter(file => file.endsWith('.spec.md'));
  
  const coverage = [];
  
  for (const specFile of specFiles) {
    const specPath = path.join(SPECS_DIR, specFile);
    const specName = path.basename(specFile, '.spec.md');
    
    console.log(`📄 Processing: ${specFile}`);
    
    const requirements = extractRequirements(specPath);
    const specCoverage = {
      name: specName,
      requirements: []
    };
    
    for (const req of requirements) {
      const implementations = findImplementation(req, SOURCE_DIRS);
      
      specCoverage.requirements.push({
        text: req,
        implemented: implementations.length > 0,
        implementations: implementations.slice(0, 3) // Top 3 matches
      });
    }
    
    coverage.push(specCoverage);
  }
  
  // Generate and save report
  const report = generateReport(coverage);
  
  // Save coverage data
  const coverageFile = path.join(__dirname, '..', 'coverage.json');
  fs.writeFileSync(coverageFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    report,
    details: coverage
  }, null, 2));
  
  console.log(`\n💾 Coverage data saved to coverage.json`);
  
  // Exit with appropriate code
  process.exit(report.percentage >= 80 ? 0 : 1);
}

// Run if executed directly
if (require.main === module) {
  main();
}
