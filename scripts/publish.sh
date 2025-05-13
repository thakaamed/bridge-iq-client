#!/bin/bash
# Script to build and publish the Bridge IQ Client package to NPM
# For ThakaaMed.ai - contact@thakaamed.com

# Ensure the script exits on any error
set -e

# Default settings
PUBLISH_TARGET="none"
VERSION_TYPE="patch"

# Display usage information
function show_help {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  -h, --help                Show this help message"
    echo "  -t, --test                Publish to NPM with tag 'next' (testing)"
    echo "  -p, --production          Publish to NPM with tag 'latest' (production)"
    echo "  -v, --version TYPE        Version bump type (patch, minor, major) [default: patch]"
    echo ""
    echo "Examples:"
    echo "  $0 --test                 Build and publish to NPM with 'next' tag"
    echo "  $0 --production           Build and publish to NPM with 'latest' tag"
    echo "  $0 --version minor --test Build with minor version bump and publish with 'next' tag"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -t|--test)
            PUBLISH_TARGET="test"
            shift
            ;;
        -p|--production)
            PUBLISH_TARGET="production"
            shift
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
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# If no target specified, just build the package
if [ "$PUBLISH_TARGET" == "none" ]; then
    echo "No publishing target specified. Will build the package only."
fi

# Clean up previous builds
echo "Cleaning up previous builds..."
rm -rf dist/ *.tgz

# Install dependencies
echo "Installing dependencies..."
npm ci

# Run tests
echo "Running tests..."
npm test

# Lint the code
echo "Linting code..."
npm run lint

# Bump version if needed
if [ "$VERSION_TYPE" != "none" ]; then
    echo "Bumping $VERSION_TYPE version..."
    npm version $VERSION_TYPE
fi

# Build the package
echo "Building package..."
npm run build

# Create a tarball for local testing
echo "Creating package tarball..."
npm pack

# Publish based on target
case $PUBLISH_TARGET in
    test)
        echo "Publishing to NPM with 'next' tag..."
        npm publish --tag next
        echo "Package published to NPM with tag 'next'!"
        ;;
    production)
        echo "Publishing to NPM with 'latest' tag..."
        npm publish
        echo "Package published to NPM with tag 'latest'!"
        ;;
    none)
        echo "Package built but not published."
        echo "To publish to NPM with 'next' tag, run: npm publish --tag next"
        echo "To publish to NPM with 'latest' tag, run: npm publish"
        ;;
esac

echo "Done!" 