from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="bridge-iq-client",
    version="1.0.0",
    author="ThakaaMed",
    author_email="contact@thakaamed.com",
    description="Python client for ThakaaMed's imaging AI service",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/thakaamed/bridge-iq-client",
    project_urls={
        "Bug Tracker": "https://github.com/thakaamed/bridge-iq-client/issues",
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Healthcare Industry",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Operating System :: OS Independent",
        "Topic :: Scientific/Engineering :: Medical Science Apps.",
    ],
    packages=find_packages(include=["bridge_iq"]),
    python_requires=">=3.9,<3.13",
    install_requires=[
        "requests>=2.25.0",
        "uuid>=1.30",
        "platformdirs>=2.0.0",
        "httpx>=0.23.0",
        "pydantic>=1.9.0",
        "python-dateutil>=2.8.2",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "black>=22.0.0",
            "isort>=5.0.0",
            "mypy>=0.910",
            "flake8>=4.0.0",
            "pytest-cov>=3.0.0",
        ],
    },
) 