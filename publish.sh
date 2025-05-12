#!/bin/bash
# Script to build and publish the Bridge IQ Client package to PyPI
# For ThakaaMed.ai - contact@thakaamed.com

# Ensure the script exits on any error
set -e

# Default settings
PUBLISH_TARGET="none"
BUMP_VERSION="patch"

# Display usage information
function show_help {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  -h, --help                Show this help message"
    echo "  -t, --test                Publish to TestPyPI"
    echo "  -p, --production          Publish to PyPI (production)"
    echo "  -v, --version TYPE        Bump version (patch, minor, major) [default: patch]"
    echo ""
    echo "Examples:"
    echo "  $0 --test                 Build and publish to TestPyPI"
    echo "  $0 --production           Build and publish to PyPI"
    echo "  $0 --version minor --test Build with minor version bump and publish to TestPyPI"
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
                BUMP_VERSION=$2
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
rm -rf dist/ build/ *.egg-info/

# Install required build tools
echo "Installing required tools..."
pip install --upgrade pip wheel build twine bumpversion

# Bump version if needed
if [ "$BUMP_VERSION" != "none" ]; then
    echo "Bumping $BUMP_VERSION version..."
    bumpversion $BUMP_VERSION
fi

# Build the package
echo "Building package..."
python -m build

# Check the distribution
echo "Checking distribution..."
twine check dist/*

echo "Distribution files created and checked."

# Publish based on target
case $PUBLISH_TARGET in
    test)
        echo "Publishing to TestPyPI..."
        twine upload --repository testpypi dist/*
        echo "Package published to TestPyPI! Install with:"
        echo "pip install --index-url https://test.pypi.org/simple/ bridge-iq-client"
        ;;
    production)
        echo "Publishing to PyPI (production)..."
        twine upload dist/*
        echo "Package published to PyPI! Install with:"
        echo "pip install bridge-iq-client"
        ;;
    none)
        echo "To upload to TestPyPI, run: twine upload --repository testpypi dist/*"
        echo "To upload to PyPI, run: twine upload dist/*"
        ;;
esac

echo "Done!" 