#!/bin/bash

# 🏷️ GitHub Repository Labels Setup Script
# This script creates and updates labels in the GitHub repository

set -e

# Disable GitHub CLI pager
export GH_PAGER=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed.${NC}"
    echo -e "${BLUE}💡 Install it from: https://cli.github.com/${NC}"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ Not authenticated with GitHub CLI.${NC}"
    echo -e "${BLUE}💡 Run: gh auth login${NC}"
    exit 1
fi

echo -e "${BLUE}🏷️ Setting up repository labels...${NC}"

# Get repository information
REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
echo -e "${GREEN}📍 Repository: ${REPO}${NC}"

# Function to create or update a label
create_or_update_label() {
    local name="$1"
    local color="$2"
    local description="$3"
    
    echo -e "${GREEN}✨ Creating/updating label: ${name}${NC}"
    
    # Try to create the label first
    if gh api "repos/${REPO}/labels" \
        --method POST \
        --field name="${name}" \
        --field color="${color}" \
        --field description="${description}" \
        --silent 2>/dev/null; then
        echo -e "${GREEN}✅ Created label successfully${NC}"
    else
        # If creation failed, try to update (label might already exist)
        echo -e "${YELLOW}🔄 Label exists, trying to update...${NC}"
        
        # URL encode the label name for the API path
        local encoded_name=$(printf '%s' "$name" | sed 's/ /%20/g' | sed 's/:/%3A/g')
        
        if gh api "repos/${REPO}/labels/${encoded_name}" \
            --method PATCH \
            --field name="${name}" \
            --field color="${color}" \
            --field description="${description}" \
            --silent 2>/dev/null; then
            echo -e "${GREEN}✅ Updated label successfully${NC}"
        else
            echo -e "${RED}❌ Failed to create/update label: ${name}${NC}"
        fi
    fi
}

# Priority Labels
echo -e "${BLUE}🎯 Creating priority labels...${NC}"
create_or_update_label "🔥 priority:high" "d73a4a" "Critical issues that need immediate attention"
create_or_update_label "⚡ priority:medium" "fbca04" "Important issues that should be addressed soon"
create_or_update_label "📝 priority:low" "0075ca" "Nice to have improvements"

# Size Labels
echo -e "${BLUE}📏 Creating size labels...${NC}"
create_or_update_label "📏 size:XS" "c2e0c6" "Extra small changes (1-10 lines)"
create_or_update_label "📏 size:S" "a3d977" "Small changes (11-100 lines)"
create_or_update_label "📏 size:M" "7fc84a" "Medium changes (101-500 lines)"
create_or_update_label "📏 size:L" "f9ca24" "Large changes (501-1000 lines)"
create_or_update_label "📏 size:XL" "e17055" "Extra large changes (1000+ lines)"

# Type Labels
echo -e "${BLUE}🔍 Creating type labels...${NC}"
create_or_update_label "🧪 type:testing" "0e8a16" "Changes related to testing"
create_or_update_label "📚 type:documentation" "1d76db" "Documentation improvements or additions"
create_or_update_label "🔒 type:security" "b60205" "Security-related changes"
create_or_update_label "🗄️ type:database" "5319e7" "Database schema or migration changes"
create_or_update_label "🐛 type:bugfix" "d73a4a" "Bug fixes"
create_or_update_label "✨ type:feature" "0075ca" "New features or enhancements"
create_or_update_label "🔧 type:maintenance" "fef2c0" "Code maintenance and refactoring"
create_or_update_label "⚡ type:performance" "f9ca24" "Performance improvements"

# Authentication & Security Labels
echo -e "${BLUE}🔐 Creating authentication & security labels...${NC}"
create_or_update_label "🔐 auth:core" "b60205" "Core authentication functionality"
create_or_update_label "🎫 auth:tokens" "d93f0b" "JWT token management and validation"
create_or_update_label "🔒 auth:2fa" "a2eeef" "Two-factor authentication features"
create_or_update_label "📱 auth:devices" "5ebeff" "Device management and multi-device support"
create_or_update_label "🔑 security:crypto" "b60205" "Cryptography and encryption"
create_or_update_label "🛡️ security:guards" "d93f0b" "Security guards and middleware"
create_or_update_label "⏱️ security:rate-limit" "f9ca24" "Rate limiting and throttling"

# Infrastructure & APIs Labels
echo -e "${BLUE}🏗️ Creating infrastructure & API labels...${NC}"
create_or_update_label "🗄️ database" "5319e7" "Database entities, migrations, and schemas"
create_or_update_label "⚙️ config" "0e8a16" "Configuration files and settings"
create_or_update_label "💊 health" "7057ff" "Health checks and monitoring"
create_or_update_label "🎮 api:controllers" "1d76db" "API controllers and endpoints"
create_or_update_label "🔗 api:grpc" "0366d6" "gRPC services and communication"
create_or_update_label "📋 api:dto" "0075ca" "Data Transfer Objects and interfaces"
create_or_update_label "🔄 middleware" "fef2c0" "Interceptors, pipes, and decorators"

# DevOps & Infrastructure Labels
echo -e "${BLUE}🚀 Creating DevOps labels...${NC}"
create_or_update_label "🐳 devops:docker" "0366d6" "Docker containers and orchestration"
create_or_update_label "⚡ devops:ci-cd" "28a745" "CI/CD workflows and automation"
create_or_update_label "🌐 devops:nginx" "6f42c1" "Nginx configuration and reverse proxy"
create_or_update_label "📜 devops:scripts" "0e8a16" "Scripts and automation tools"

# Documentation Labels
echo -e "${BLUE}📚 Creating documentation labels...${NC}"
create_or_update_label "📐 docs:architecture" "1d76db" "Architecture and system design documentation"
create_or_update_label "📋 docs:specs" "0075ca" "Functional and technical specifications"
create_or_update_label "🔧 docs:operations" "28a745" "Deployment and operational documentation"
create_or_update_label "🔗 docs:integration" "0366d6" "Integration and migration guides"
create_or_update_label "📊 docs:governance" "6f42c1" "Governance and architectural decisions"
create_or_update_label "📖 documentation" "1d76db" "General documentation updates"

# Development Tools Labels
echo -e "${BLUE}🔧 Creating development tools labels...${NC}"
create_or_update_label "📦 dependencies" "0e8a16" "Package dependencies and updates"
create_or_update_label "🎨 tools:linting" "f9ca24" "Code linting and formatting tools"
create_or_update_label "📝 tools:git" "586069" "Git configuration and version control"
create_or_update_label "🔒 tools:security" "b60205" "Security scanning and analysis tools"

# Testing Labels
echo -e "${BLUE}🧪 Creating testing labels...${NC}"
create_or_update_label "🧪 tests:unit" "0e8a16" "Unit tests and test coverage"
create_or_update_label "🔬 tests:e2e" "28a745" "End-to-end and integration tests"

# Special Impact Labels
echo -e "${BLUE}💥 Creating special impact labels...${NC}"
create_or_update_label "💥 breaking-change" "d73a4a" "Changes that break backward compatibility"
create_or_update_label "⚡ performance" "f9ca24" "Performance-critical changes"
create_or_update_label "🌍 external" "0366d6" "External service integrations and dependencies"

# Workflow States Labels
echo -e "${BLUE}🔄 Creating workflow state labels...${NC}"
create_or_update_label "🔄 status:in-progress" "fbca04" "Work in progress"
create_or_update_label "👀 status:needs-review" "0075ca" "Ready for review"
create_or_update_label "🔴 status:blocked" "d73a4a" "Blocked by dependencies or issues"
create_or_update_label "✅ status:ready-to-merge" "0e8a16" "Approved and ready to merge"
create_or_update_label "❌ status:needs-changes" "e99695" "Changes requested by reviewers"

# Review Categories Labels
echo -e "${BLUE}👨‍💻 Creating review category labels...${NC}"
create_or_update_label "👨‍💻 review:backend" "5319e7" "Requires backend developer review"
create_or_update_label "🔒 review:security" "b60205" "Requires security team review"
create_or_update_label "🚀 review:devops" "0366d6" "Requires DevOps team review"
create_or_update_label "🏗️ review:architecture" "6f42c1" "Requires architecture review"

# Issue Labels
echo -e "${BLUE}🚨 Creating issue labels...${NC}"
create_or_update_label "🐛 bug" "d73a4a" "Something isn't working"
create_or_update_label "✨ enhancement" "0075ca" "New feature or request"
create_or_update_label "❓ question" "d876e3" "Further information is requested"
create_or_update_label "📖 good first issue" "7057ff" "Good for newcomers"
create_or_update_label "🆘 help wanted" "0e8a16" "Extra attention is needed"
create_or_update_label "🚫 wontfix" "586069" "This will not be worked on"
create_or_update_label "🔄 duplicate" "cfd3d7" "This issue or pull request already exists"

echo -e "${GREEN}🎉 All labels have been created/updated successfully!${NC}"
echo -e "${BLUE}💡 You can now use the auto-labeller workflow to automatically assign these labels to PRs.${NC}"
echo -e "${BLUE}🔗 View labels at: https://github.com/${REPO}/labels${NC}"
