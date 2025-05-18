#!/bin/bash
# Script to build and publish the Bridge IQ Client package to NPM
# For ThakaaMed.ai - contact@thakaamed.com

# Ensure the script exits on any error
set -e

# Default values
VERSION_TYPE="patch"
SKIP_LINT=false
TEST_MODE=false
PRODUCTION_MODE=false
DRY_RUN=false

# Display usage information
function show_help {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  -h, --help                Show this help message"
    echo "  -t, --test                Publish to NPM with tag 'next' (testing)"
    echo "  -p, --production          Publish to NPM with tag 'latest' (production)"
    echo "  -v, --version TYPE        Version bump type (patch, minor, major) [default: patch]"
    echo "  -s, --skip-lint           Skip linting step"
    echo "  -d, --dry-run             Test the publishing process without actually publishing"
    echo ""
    echo "Examples:"
    echo "  $0 --test                 Build and publish to NPM with 'next' tag"
    echo "  $0 --production           Build and publish to NPM with 'latest' tag"
    echo "  $0 --version minor --test Build with minor version bump and publish with 'next' tag"
    echo "  $0 --skip-lint            Skip linting (useful for quick publishing)"
    echo "  $0 --dry-run              Run through the process without publishing"
}

# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -t|--test)
            TEST_MODE=true
            ;;
        -p|--production)
            PRODUCTION_MODE=true
            ;;
        -v|--version)
            if [[ $2 == "patch" || $2 == "minor" || $2 == "major" ]]; then
                VERSION_TYPE=$2
                shift 2
            else
                echo "Error: Version must be patch, minor, or major"
                exit 1
            fi
            ;;
        -s|--skip-lint)
            SKIP_LINT=true
            ;;
        -d|--dry-run)
            DRY_RUN=true
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
    shift
done

# Check if at least one mode is specified unless it's a dry run
if [[ $PRODUCTION_MODE == false && $TEST_MODE == false && $DRY_RUN == false ]]; then
    echo "Error: Please specify --test or --production mode, or --dry-run"
    show_help
    exit 1
fi

# Clean up previous builds
echo "Cleaning up previous builds..."
rm -rf dist/ *.tgz

# Install dependencies
echo "Installing dependencies..."
npm ci --legacy-peer-deps

# Run tests
echo "======== Running tests ========"
npm test -- --no-typecheck

# Lint the code (unless skipped)
if [ "$SKIP_LINT" == "false" ]; then
    echo "======== Running linting checks ========"
    echo "Linting code..."
    npm run lint
else
    echo "Skipping linting step..."
fi

# Bump version if not in dry-run mode
if [[ $DRY_RUN == false ]]; then
    echo "======== Bumping $VERSION_TYPE version ========"
    echo "Bumping $VERSION_TYPE version..."
    npm version $VERSION_TYPE --no-git-tag-version
fi

# Build the package
echo "======== Building package ========"
echo "Building package..."
npm run build

# Create a tarball for local testing
echo "Creating package tarball..."
npm pack

# Determine tag and execute publish
TAG=""
if [[ $TEST_MODE == true ]]; then
    TAG="next"
elif [[ $PRODUCTION_MODE == true ]]; then
    TAG="latest"
fi

# If we're in dry-run mode, simulate but don't publish
if [[ $DRY_RUN == true ]]; then
    echo "======== DRY RUN - Package is ready for publishing ========"
    echo "Version bump type: $VERSION_TYPE"
    echo "Files to be published:"
    npm pack --dry-run
else
    echo "======== Publishing to NPM with tag: $TAG ========"
    echo "Publishing to NPM with tag '$TAG'..."
    npm publish --tag=$TAG --legacy-peer-deps
    echo "Package published to NPM with tag '$TAG'!"
fi

echo "======== Done! ========" 