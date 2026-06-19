'use client';

/**
 * Conditionally renders children based on a permission check (Foundation F1/F3).
 * Pass the `can` function from usePermissions and the required `permission` key.
 *
 *   <PermissionGate can={can} permission="payments.refund" fallback={<NoAccess/>}>
 *     <RefundButton />
 *   </PermissionGate>
 */
export default function PermissionGate({ can, permission, fallback = null, children }) {
  if (!permission) return children;
  return can && can(permission) ? children : fallback;
}
