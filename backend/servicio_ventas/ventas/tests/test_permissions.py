import jwt
import types
import pytest
from django.conf import settings
from rest_framework.test import APIRequestFactory
from ventas.permissions import (
    IsEmployeeUser,
    CanCreateOrder,
    HasPermission,
    CanManagePayments,
)


class DummyUser:
    def __init__(self, is_authenticated=True, role=None):
        self.is_authenticated = is_authenticated
        self.role = role


class DummyRole:
    def __init__(self, name):
        self.name = name


factory = APIRequestFactory()


@pytest.mark.django_db
class TestPermissions:
    def test_is_employee_user_allows_employee_roles(self):
        request = factory.get('/some-path')
        request.user = DummyUser(role=DummyRole('employee'))
        perm = IsEmployeeUser()
        assert perm.has_permission(request, view=None) is True

    def test_is_employee_user_denies_when_no_role(self):
        request = factory.get('/some-path')
        request.user = DummyUser(role=None)
        perm = IsEmployeeUser()
        assert perm.has_permission(request, view=None) is False

    def test_can_create_order_post_requires_employee(self):
        request = factory.post('/orders/')
        request.user = DummyUser(role=DummyRole('manager'))
        perm = CanCreateOrder()
        assert perm.has_permission(request, view=None) is True

    def test_can_create_order_get_allows_any(self):
        # Nota: Implementación actual permite cualquier GET (devuelve True sin validar usuario)
        request = factory.get('/orders/')
        request.user = DummyUser(is_authenticated=False)
        perm = CanCreateOrder()
        assert perm.has_permission(request, view=None) is True

    def test_has_permission_with_required_permission(self):
        token = jwt.encode({'permissions': ['perm_x']}, settings.SECRET_KEY, algorithm='HS256')
        request = factory.get('/with-perm', HTTP_AUTHORIZATION=f'Bearer {token}')
        request.user = DummyUser()

        # Vista con permiso requerido
        view = types.SimpleNamespace(required_permission='perm_x')
        perm = HasPermission()
        assert perm.has_permission(request, view=view) is True

    def test_can_manage_payments_read_and_create(self):
        # GET con read_payments
        token_get = jwt.encode({'permissions': ['read_payments']}, settings.SECRET_KEY, algorithm='HS256')
        req_get = factory.get('/payments', HTTP_AUTHORIZATION=f'Bearer {token_get}')
        req_get.user = DummyUser()
        perm = CanManagePayments()
        assert perm.has_permission(req_get, view=None) is True

        # POST con create_payments
        token_post = jwt.encode({'permissions': ['create_payments']}, settings.SECRET_KEY, algorithm='HS256')
        req_post = factory.post('/payments', HTTP_AUTHORIZATION=f'Bearer {token_post}')
        req_post.user = DummyUser()
        assert perm.has_permission(req_post, view=None) is True

    def test_can_manage_payments_invalid_token_or_missing_header(self):
        # Sin header
        req_no_header = factory.get('/payments')
        req_no_header.user = DummyUser()
        assert CanManagePayments().has_permission(req_no_header, view=None) is False

        # Token inválido
        req_bad_token = factory.get('/payments', HTTP_AUTHORIZATION='Bearer invalid.token')
        req_bad_token.user = DummyUser()
        assert CanManagePayments().has_permission(req_bad_token, view=None) is False
