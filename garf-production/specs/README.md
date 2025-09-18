# GARF Specifications Directory

This directory contains all specifications for the GARF Grouping Engine project, following Spec-Driven Development principles.

## 📋 Current Specifications

### Core Functionality
- **[grouping-run.spec.md](./grouping-run.spec.md)** - Main grouping workflow from trigger to persistence
- **[two-phase-builder.spec.md](./two-phase-builder.spec.md)** - Two-phase group building algorithm

### Constraints & Rules
- **[kosher-filter.spec.md](./kosher-filter.spec.md)** - Kosher-only filtering system
- **[age-bands.spec.md](./age-bands.spec.md)** - Age-based compatibility rules
- **[allergy-management.spec.md](./allergy-management.spec.md)** - Allergy tracking and limits

### Quality & Optimization
- **[scoring-system.spec.md](./scoring-system.spec.md)** - Group quality scoring mechanism

## 🎯 Specification Structure

Each specification follows this template:

```markdown
# Specification: [Feature Name]

## Goal
As a [role], I want [feature] so that [benefit].

## Requirements
1. Functional requirements
2. Technical requirements
3. UI/UX requirements

## Constraints
- Hard limits
- Performance requirements
- Compatibility needs

## Success Criteria
- Measurable outcomes
- Test conditions
- Acceptance criteria

## Dependencies
- Required modules
- External systems
- Prerequisites

## Technical Details
- Implementation notes
- Code examples
- Architecture decisions

## Testing Strategy
- Unit tests
- Integration tests
- Performance tests

## Security Considerations
- Data protection
- Access control
- Audit requirements
```

## 🚀 Using Spec Kit

### View All Specifications
```bash
npm run specify
```

### Generate Development Plan
```bash
npm run plan
```

### Create Tasks from Specs
```bash
npm run tasks
```

### Validate Specifications
```bash
npm run spec:validate
```

### Generate Documentation
```bash
npm run spec:generate
```

### Check Implementation Coverage
```bash
npm run spec:coverage
```

## 📊 Specification Status

| Specification | Status | Implementation | Tests | Docs |
|--------------|--------|---------------|-------|------|
| Grouping Run | ✅ Complete | ✅ Implemented | ⚠️ Partial | ✅ Yes |
| Kosher Filter | ✅ Complete | ✅ Implemented | ✅ Complete | ✅ Yes |
| Age Bands | ✅ Complete | ✅ Implemented | ✅ Complete | ✅ Yes |
| Allergy Management | ✅ Complete | ✅ Implemented | ⚠️ Partial | ✅ Yes |
| Scoring System | ✅ Complete | ✅ Implemented | ⚠️ Partial | ✅ Yes |
| Two-Phase Builder | ✅ Complete | ✅ Implemented | ⚠️ Partial | ✅ Yes |

## 🔄 Workflow

1. **Write Specification** - Create `.spec.md` file in this directory
2. **Validate** - Run `npm run spec:validate` to ensure format
3. **Plan** - Use `npm run plan` to estimate effort
4. **Generate Tasks** - Run `npm run tasks` to create GitHub issues
5. **Implement** - Build according to specification
6. **Test** - Write tests covering success criteria
7. **Document** - Generate docs with `npm run spec:generate`
8. **Verify Coverage** - Check with `npm run spec:coverage`

## 📝 Best Practices

### DO:
- Write specs BEFORE implementation
- Include clear success criteria
- Define measurable constraints
- Consider security from the start
- Include code examples where helpful

### DON'T:
- Skip the specification phase
- Write vague requirements
- Ignore dependencies
- Forget about testing strategy
- Omit security considerations

## 🎨 Specification Templates

### For New Features
Use the standard template above

### For Bug Fixes
```markdown
# Specification: Fix [Issue]

## Problem
Description of the bug

## Root Cause
Technical explanation

## Solution
Proposed fix

## Testing
How to verify the fix
```

### For Performance Improvements
```markdown
# Specification: Optimize [Component]

## Current Performance
Baseline metrics

## Target Performance
Goal metrics

## Optimization Strategy
Technical approach

## Measurement
How to validate improvement
```

## 📚 Resources

- [Spec Kit Documentation](https://github.com/github/spec-kit)
- [Spec-Driven Development Guide](https://spec-driven.dev)
- [GARF Project Documentation](../INTEGRATION_README.md)

## 🤝 Contributing

1. Create a new branch for your specification
2. Write the spec following the template
3. Run validation: `npm run spec:validate`
4. Submit PR for review
5. Once approved, generate tasks and begin implementation

## 📞 Contact

For questions about specifications:
- Create an issue with label `spec-question`
- Reach out to the GARF team
- Check the project wiki
