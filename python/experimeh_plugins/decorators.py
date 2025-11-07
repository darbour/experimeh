"""
Plugin Registration and Discovery

Provides decorator-based plugin registration system for easy plugin development.
Plugins are automatically discovered and validated at import time.

Example:
    @analysis_plugin(
        name="welch_ttest",
        version="1.0.0",
        author="Statistics Team",
        description="Welch's t-test for unequal variances",
        design_types=["ab"],
        required_metrics=["metric"]
    )
    class WelchTTest(AnalysisPlugin):
        # Implementation
        pass
"""

from typing import Callable, Type, Dict, List, Any
from functools import wraps
import inspect

from .base import AnalysisPlugin

# Global plugin registry
_PLUGIN_REGISTRY: Dict[str, Type[AnalysisPlugin]] = {}


def analysis_plugin(
    name: str,
    version: str,
    author: str,
    description: str,
    design_types: List[str],
    required_metrics: List[str]
) -> Callable[[Type[AnalysisPlugin]], Type[AnalysisPlugin]]:
    """Decorator for registering analysis plugins

    Validates the plugin class and registers it in the global registry.

    Args:
        name: Unique plugin identifier (snake_case)
        version: Semantic version (e.g., "1.0.0")
        author: Author or team name
        description: Short description
        design_types: List of supported design types
        required_metrics: List of required metric columns

    Returns:
        Decorated plugin class

    Raises:
        TypeError: If class doesn't inherit from AnalysisPlugin
        AttributeError: If required methods are missing
        ValueError: If plugin name already registered

    Example:
        @analysis_plugin(
            name="my_test",
            version="1.0.0",
            author="Data Team",
            description="Custom test",
            design_types=["ab"],
            required_metrics=["metric"]
        )
        class MyTest(AnalysisPlugin):
            pass
    """
    def decorator(cls: Type[AnalysisPlugin]) -> Type[AnalysisPlugin]:
        # Validate class inheritance
        if not issubclass(cls, AnalysisPlugin):
            raise TypeError(
                f"{cls.__name__} must inherit from AnalysisPlugin"
            )

        # Check required methods
        required_methods = ['_get_metadata', '_get_capabilities', 'analyze']
        for method_name in required_methods:
            if not hasattr(cls, method_name):
                raise AttributeError(
                    f"{cls.__name__} must implement {method_name}()"
                )

        # Validate name format
        if not name.replace('_', '').isalnum() or name != name.lower():
            raise ValueError(
                f"Plugin name must be lowercase alphanumeric with underscores: {name}"
            )

        # Check for name conflicts
        if name in _PLUGIN_REGISTRY:
            existing = _PLUGIN_REGISTRY[name]
            raise ValueError(
                f"Plugin name '{name}' already registered by {existing.__name__}"
            )

        # Store metadata on class
        cls._plugin_metadata = {
            'name': name,
            'version': version,
            'author': author,
            'description': description,
            'design_types': design_types,
            'required_metrics': required_metrics,
            'class_name': cls.__name__,
            'module': cls.__module__
        }

        # Register plugin
        _PLUGIN_REGISTRY[name] = cls

        # Add docstring info
        if cls.__doc__:
            cls.__doc__ = f"""
{cls.__doc__}

Plugin Information:
- Name: {name}
- Version: {version}
- Author: {author}
- Supported designs: {', '.join(design_types)}
- Required metrics: {', '.join(required_metrics)}
"""

        return cls

    return decorator


def get_plugin(name: str) -> Type[AnalysisPlugin]:
    """Get plugin class by name

    Args:
        name: Plugin identifier

    Returns:
        Plugin class

    Raises:
        KeyError: If plugin not found

    Example:
        PluginClass = get_plugin('welch_ttest')
        plugin = PluginClass()
    """
    if name not in _PLUGIN_REGISTRY:
        available = ', '.join(_PLUGIN_REGISTRY.keys())
        raise KeyError(
            f"Plugin '{name}' not registered. "
            f"Available plugins: {available}"
        )
    return _PLUGIN_REGISTRY[name]


def list_plugins() -> List[Dict[str, Any]]:
    """List all registered plugins

    Returns:
        List of plugin metadata dictionaries

    Example:
        for plugin_info in list_plugins():
            print(f"{plugin_info['name']}: {plugin_info['description']}")
    """
    return [
        {
            'name': name,
            'class': cls,
            'metadata': cls._plugin_metadata
        }
        for name, cls in _PLUGIN_REGISTRY.items()
    ]


def get_plugins_by_design(design_type: str) -> List[Type[AnalysisPlugin]]:
    """Get all plugins supporting a specific design type

    Args:
        design_type: Design type to filter by

    Returns:
        List of plugin classes supporting the design

    Example:
        factorial_plugins = get_plugins_by_design('factorial')
    """
    return [
        cls for cls in _PLUGIN_REGISTRY.values()
        if design_type in cls._plugin_metadata['design_types']
    ]


def unregister_plugin(name: str) -> bool:
    """Unregister a plugin (mainly for testing)

    Args:
        name: Plugin name to unregister

    Returns:
        True if unregistered, False if not found
    """
    if name in _PLUGIN_REGISTRY:
        del _PLUGIN_REGISTRY[name]
        return True
    return False


def clear_registry():
    """Clear all registered plugins (mainly for testing)"""
    _PLUGIN_REGISTRY.clear()
