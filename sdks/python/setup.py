"""Setup configuration for the Experimeh Python SDK."""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="experimeh",
    version="1.0.0",
    author="Experimeh Team",
    author_email="team@experimeh.com",
    description="Python SDK for the Experimeh feature flag experimentation platform",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/experimeh/experimeh-python-sdk",
    packages=find_packages(exclude=["tests", "tests.*", "examples", "examples.*"]),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
    install_requires=requirements,
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "pytest-cov>=4.0.0",
            "pytest-mock>=3.10.0",
            "black>=23.0.0",
            "mypy>=1.0.0",
            "flake8>=6.0.0",
            "isort>=5.12.0",
        ],
        "redis": [
            "redis>=4.5.0",
        ],
    },
    keywords="experimentation ab-testing feature-flags experiments factorial-design",
    project_urls={
        "Documentation": "https://docs.experimeh.com",
        "Source": "https://github.com/experimeh/experimeh-python-sdk",
        "Bug Reports": "https://github.com/experimeh/experimeh-python-sdk/issues",
    },
)
