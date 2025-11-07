"""
Setup script for experimeh-plugins

Allows installation via pip:
    pip install -e .
"""

from setuptools import setup, find_packages

setup(
    packages=find_packages(include=['experimeh_plugins', 'experimeh_plugins.*']),
    include_package_data=True,
)
