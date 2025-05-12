#!/bin/bash
# Script to build and publish the Bridge IQ Client package to PyPI

# Ensure the script exits on any error
set -e

# Print each command before executing
set -x

# Clean up previous builds
rm -rf dist/ build/ *.egg-info/

# Install required build tools
pip install --upgrade pip wheel build twine

# Build the package
python -m build

# Check the distribution
twine check dist/*

echo "Distribution files created and checked."
echo "To upload to TestPyPI, run: twine upload --repository testpypi dist/*"
echo "To upload to PyPI, run: twine upload dist/*" 