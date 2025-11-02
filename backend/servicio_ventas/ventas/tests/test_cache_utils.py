import pytest
from unittest.mock import Mock, patch
from django.core.cache import cache
from ventas.cache_manager import CacheManager
from ventas.utils import format_clp, parse_clp


@pytest.mark.django_db
class TestCacheManager:
    def setup_method(self):
        cache.clear()

    def test_get_customer_from_cache(self):
        key = CacheManager.get_cache_key('customer', 1)
        cache.set(key, {'id': 1, 'name': 'Alice'}, 60)
        client = Mock()
        result = CacheManager.get_customer(1, client)
        assert result == {'id': 1, 'name': 'Alice'}
        client.get.assert_not_called()

    def test_get_customer_fetch_and_cache(self):
        client = Mock()
        client.get.return_value = {'data': {'id': 2, 'name': 'Bob'}}
        result = CacheManager.get_customer(2, client)
        assert result == {'id': 2, 'name': 'Bob'}
        key = CacheManager.get_cache_key('customer', 2)
        assert cache.get(key) == {'id': 2, 'name': 'Bob'}

    def test_get_customer_error_response(self):
        client = Mock()
        client.get.return_value = {'success': False, 'error': 'nope'}
        result = CacheManager.get_customer(3, client)
        assert result is None

    def test_clear_all_service_cache_fallback(self):
        # En backends sin delete_pattern, el método debe hacer cache.clear()
        cache.set('service_data:customer:9', {'id': 9}, 60)
        CacheManager.clear_all_service_cache()
        assert cache.get('service_data:customer:9') is None

    def test_get_cache_stats(self):
        stats = CacheManager.get_cache_stats()
        assert isinstance(stats, dict)
        assert 'cache_backend' in stats


class TestUtils:
    def test_format_clp(self):
        assert format_clp(1234567) == '$1.234.567'
        assert format_clp('2000') == '$2.000'
        assert format_clp(None) == '$0'

    def test_parse_clp(self):
        assert parse_clp('$1.234.567') == 1234567
        assert parse_clp('') == 0
        assert parse_clp(None) == 0
