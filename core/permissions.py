from rest_framework.permissions import BasePermission

class IsCashier(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_cashier

class IsManagerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (request.user.is_manager or request.user.is_admin)
    
class IsCashierOrManager(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return user and user.is_authenticated and (user.is_cashier or user.is_manager)
