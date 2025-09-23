# Lock Management Workflow Implementation

## Overview

This document describes the comprehensive lock management workflow implemented to handle `ScopeLocked` errors when removing permissions from Azure resources.

## Problem Statement

When attempting to remove user permissions from Azure resources (like Storage Accounts), the operation may fail with a `ScopeLocked` error if the resource has locks applied. The error message typically looks like:

```
{
  code: "ScopeLocked",
  message: "The scope '/subscriptions/.../resourceGroups/.../providers/Microsoft.Storage/storageAccounts/...' cannot perform delete operation because following scope(s) are locked: '/subscriptions/.../resourceGroups/.../providers/Microsoft.Storage/storageAccounts/...'. Please remove the lock and try again."
}
```

## Solution Implementation

### 1. LockManagementService

**Location**: `src/app/services/lock-management.service.ts`

This service handles the complete lock management workflow:

- **Error Detection**: Identifies `ScopeLocked` errors
- **User Confirmation**: Shows a detailed modal asking for permission to temporarily remove locks
- **Lock Management**: Temporarily removes locks, performs the operation, then recreates locks
- **Error Handling**: Provides comprehensive error handling throughout the process

### 2. LockConfirmationModalComponent

**Location**: `src/app/components/lock-confirmation-modal/lock-confirmation-modal.component.ts`

A user-friendly modal component that:

- Displays the resource name and lock details
- Explains the workflow to the user
- Provides clear confirmation options
- Shows loading states during the process

### 3. Integration with PermissionsService

**Location**: `src/app/services/permissions.service.ts`

The permissions service has been updated to:

- Use the `LockManagementService` for handling `ScopeLocked` errors
- Automatically detect and handle lock-related errors
- Maintain backward compatibility with existing functionality

## Workflow Steps

1. **Permission Removal Attempt**: User tries to remove a permission
2. **Error Detection**: If a `ScopeLocked` error occurs, it's automatically detected
3. **User Confirmation**: A modal appears explaining the situation and asking for confirmation
4. **Lock Retrieval**: The system fetches current lock details for the resource
5. **Lock Removal**: If user confirms, existing locks are temporarily removed
6. **Permission Removal**: The original permission removal operation is performed
7. **Lock Recreation**: The previously removed locks are recreated
8. **User Feedback**: Success or error messages are displayed to the user

## Key Features

### Automatic Error Detection

The system automatically detects `ScopeLocked` errors through multiple patterns:
- `error.code === 'ScopeLocked'`
- `error.error.code === 'ScopeLocked'`
- Error message contains "scope(s) are locked"

### User-Friendly Interface

- Clear explanation of what locks are and why they prevent the operation
- Display of specific lock details (name, level, notes)
- Prominent warning about temporary lock removal
- Loading states during the process

### Robust Error Handling

- Graceful handling of lock retrieval failures
- Fallback to simple confirmation if detailed lock info unavailable
- Proper error propagation and user notification
- Automatic lock recreation even if permission removal fails

### Resource Protection

- Locks are only temporarily removed during the operation
- Original lock configuration is preserved and recreated
- Multiple lock types are supported (CanNotDelete, ReadOnly)

## Testing

### Manual Testing

1. **Setup**: Ensure a storage account has locks applied
2. **Trigger**: Try to remove a user permission from that storage account
3. **Verify**: The lock confirmation modal should appear
4. **Confirm**: Click "Remove Lock & Continue"
5. **Observe**: The operation should complete and locks should be recreated

### Console Testing

A test helper is available at `src/app/test-lock-workflow.ts` for programmatic testing.

### Browser Console Debugging

The implementation includes console logging for debugging:
- `🔒 ScopeLocked error detected:` - When a ScopeLocked error is identified
- `🔧 Handling ScopeLocked error for resource:` - When the workflow begins

## Error Scenarios Handled

1. **Lock Retrieval Failure**: Falls back to simple confirmation
2. **Lock Removal Failure**: Shows error message, doesn't proceed
3. **Permission Removal Failure**: Shows error, attempts to recreate locks
4. **Lock Recreation Failure**: Shows warning about manual lock recreation needed

## Files Modified/Created

### New Files
- `src/app/services/lock-management.service.ts`
- `src/app/components/lock-confirmation-modal/lock-confirmation-modal.component.ts`
- `src/app/test-lock-workflow.ts`
- `LOCK_MANAGEMENT_WORKFLOW.md`

### Modified Files
- `src/app/services/permissions.service.ts` - Integrated lock management

## Usage Examples

### Individual Permission Removal

When removing a single permission, if a `ScopeLocked` error occurs:

```typescript
// This is handled automatically in removeStorageAccountPermissionWithLockHandling
this.permissionsService.removeStorageAccountPermissionWithLockHandling(assignmentId, storageAccountId)
  .subscribe({
    next: (result) => console.log('Permission removed successfully'),
    error: (error) => console.error('Failed to remove permission', error)
  });
```

### Bulk Permission Removal

Bulk operations also benefit from the lock management workflow:

```typescript
// Each individual removal in the bulk operation uses lock management
this.permissionsService.bulkRemoveStorageAccountPermissions(assignments)
  .subscribe({
    next: (results) => console.log('Bulk removal completed'),
    error: (error) => console.error('Bulk removal failed', error)
  });
```

## Security Considerations

- Locks are only temporarily removed with explicit user consent
- The workflow preserves the original security posture by recreating locks
- All operations are logged for audit purposes
- User must have appropriate permissions to manage both locks and role assignments

## Future Enhancements

- Support for additional Azure resource types
- Batch lock management for multiple resources
- Integration with Azure Policy for lock management governance
- Enhanced audit logging and reporting