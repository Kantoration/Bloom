/**
 * Spec Kit Configuration
 * Defines how specifications are managed and validated
 */

module.exports = {
  // Directory containing specifications
  specsDir: './specs',
  
  // Output directory for generated documentation
  docsDir: './docs/specs',
  
  // Template for new specifications
  template: 'default',
  
  // Validation rules
  validation: {
    // Require all specs to have these sections
    requiredSections: [
      'Goal',
      'Requirements',
      'Success Criteria'
    ],
    
    // Optional sections
    optionalSections: [
      'Constraints',
      'Dependencies',
      'Technical Details',
      'Testing Strategy',
      'Security Considerations'
    ],
    
    // Enforce naming convention
    fileNaming: {
      pattern: /^[a-z0-9-]+\.spec\.md$/,
      message: 'Spec files must use kebab-case and end with .spec.md'
    }
  },
  
  // Task generation settings
  tasks: {
    // Auto-generate GitHub issues from specs
    githubIntegration: true,
    
    // Task priority mapping
    priorityMapping: {
      'critical': 'P0',
      'high': 'P1',
      'medium': 'P2',
      'low': 'P3'
    },
    
    // Default labels for generated tasks
    defaultLabels: ['spec-driven', 'auto-generated']
  },
  
  // Planning configuration
  planning: {
    // Estimation method
    estimationMethod: 'fibonacci', // or 't-shirt', 'hours'
    
    // Sprint duration for planning
    sprintDuration: 14, // days
    
    // Team velocity (story points per sprint)
    velocity: 21
  },
  
  // Coverage analysis
  coverage: {
    // Directories to analyze for implementation
    sourceDirs: [
      './src',
      './api',
      './'
    ],
    
    // File patterns to include
    includePatterns: [
      '**/*.ts',
      '**/*.tsx'
    ],
    
    // File patterns to exclude
    excludePatterns: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/node_modules/**'
    ],
    
    // Minimum coverage threshold
    threshold: 80
  },
  
  // Documentation generation
  documentation: {
    // Format for generated docs
    format: 'markdown', // or 'html', 'pdf'
    
    // Include diagrams
    diagrams: true,
    
    // Generate API documentation
    includeApi: true,
    
    // Generate test documentation
    includeTests: true
  },
  
  // Hooks for custom behavior
  hooks: {
    // Run before specification validation
    preValidate: async (spec) => {
      console.log(`Validating spec: ${spec.name}`);
      return spec;
    },
    
    // Run after task generation
    postGenerate: async (tasks) => {
      console.log(`Generated ${tasks.length} tasks`);
      return tasks;
    },
    
    // Run before planning
    prePlan: async (specs) => {
      console.log(`Planning ${specs.length} specifications`);
      return specs;
    }
  }
};
