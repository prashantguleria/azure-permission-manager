import { Injectable } from '@angular/core';
import { Observable, throwError, of, forkJoin, firstValueFrom } from 'rxjs';
import { switchMap, map, catchError, tap } from 'rxjs/operators';
import { AzureApiService } from './azure-api.service';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzMessageService } from 'ng-zorro-antd/message';
import { LockConfirmationModalComponent, LockConfirmationData } from '../components/lock-confirmation-modal/lock-confirmation-modal.component';
import { AppAuditService } from './app-audit.service';

export interface LockInfo {
  id: string;
  name: string;
  level: 'ReadOnly' | 'Delete' | 'CanNotDelete';
  notes?: string;
}

export interface ScopeLockedError {
  code: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class LockManagementService {

  constructor(
    private azureApiService: AzureApiService,
    private modal: NzModalService,
    private message: NzMessageService,
    private appAuditService: AppAuditService
  ) {}

 /**
   * Check if an error is a ScopeLocked error
   */
  isScopeLockedError(error: any): boolean {
    let isScopeLocked = false;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;
    
    // Handle HttpErrorResponse structure
    if (error?.error?.error?.code) {
      // HttpErrorResponse: error.error.error.code
      errorCode = error.error.error.code;
      errorMessage = error.error.error.message;
      isScopeLocked = errorCode === 'ScopeLocked';
    } else if (error?.error?.code) {
      // Direct error structure: error.error.code
      errorCode = error.error.code;
      errorMessage = error.error.message;
      isScopeLocked = errorCode === 'ScopeLocked';
    } else {
      // Fallback: check message content
      const message = error?.message || error?.error?.message || '';
      isScopeLocked = message.includes('ScopeLocked');
      errorMessage = message;
    }
    
    console.log('🔍 Lock Management: Checking if error is ScopeLocked:', {
      error: error,
      errorCode: errorCode,
      errorMessage: errorMessage,
      message: error?.message,
      isScopeLocked: isScopeLocked
    });
    
    return isScopeLocked;
  }



  /**
   * Extract resource ID from ScopeLocked error message
   */
  extractResourceIdFromError(error: any): string | null {
    let message = '';
    
    // Handle HttpErrorResponse structure
    if (error?.error?.error?.message) {
      // HttpErrorResponse: error.error.error.message
      message = error.error.error.message;
    } else if (error?.error?.message) {
      // Direct error structure: error.error.message
      message = error.error.message;
    } else {
      // Fallback: check top-level message
      message = error?.message || '';
    }
    
    const match = message.match(/following scope\(s\) are locked: '([^']+)'/);
    return match ? match[1] : null;
  }

  /**
   * Extract a user-friendly resource name from resource ID
   */
  private extractResourceNameFromId(resourceId: string): string {
    if (!resourceId) {
      return 'Unknown Resource';
    }
    
    // Extract the last part of the resource path as the name
    const parts = resourceId.split('/');
    const resourceName = parts[parts.length - 1];
    
    // If we can identify the resource type, format it nicely
    if (resourceId.includes('/storageAccounts/')) {
      return `Storage Account: ${resourceName}`;
    } else if (resourceId.includes('/resourceGroups/')) {
      return `Resource Group: ${resourceName}`;
    } else if (resourceId.includes('/subscriptions/')) {
      return `Subscription: ${resourceName}`;
    }
    
    return resourceName || 'Unknown Resource';
  }

  /**
   * Show lock removal confirmation dialog
   */
  private async showLockRemovalConfirmation(resourceId: string): Promise<boolean> {
    const resourceName = this.extractResourceNameFromId(resourceId);
    
    return new Promise((resolve) => {
      const modal = this.modal.confirm({
        nzTitle: 'Resource Lock Detected',
        nzContent: `
          <p>The resource "${resourceName}" is locked and cannot be modified.</p>
          <p>Would you like to temporarily remove the lock to perform the operation?</p>
          <p><strong>Note:</strong> The lock will be recreated after the operation completes.</p>
        `,
        nzOkText: 'Remove Lock & Continue',
        nzOkType: 'primary',
        nzOkDanger: true,
        nzCancelText: 'Cancel',
        nzOnOk: () => resolve(true),
        nzOnCancel: () => resolve(false)
      });
    });
  }

  /**
   * Handle ScopeLocked error with user confirmation
   */
  async handleScopeLockedError(error: any, operation: () => Promise<any>): Promise<any> {
    console.log('🚨 Lock Management: Handling ScopeLocked error:', error);
    
    const resourceId = this.extractResourceIdFromError(error);
    console.log('🔍 Lock Management: Extracted resource ID:', resourceId);
    
    if (!resourceId) {
      console.error('❌ Lock Management: Could not extract resource ID from error');
      throw error;
    }

    console.log('💬 Lock Management: Showing confirmation dialog for resource:', resourceId);
    const confirmed = await this.showLockRemovalConfirmation(resourceId);
    console.log('✅ Lock Management: User confirmation result:', confirmed);
    
    if (!confirmed) {
      console.log('❌ Lock Management: User cancelled lock removal');
      throw new Error('Lock removal cancelled by user');
    }

    console.log('🔄 Lock Management: Proceeding with lock management workflow');
    return this.executeWithLockManagement(resourceId, operation);
  }

  /**
   * Handle ScopeLocked error with user confirmation (Observable version)
   */
  handleScopeLockedErrorObservable(
    error: ScopeLockedError,
    resourceId: string,
    operation: () => Observable<any>,
    operationType: string = 'operation'
  ): Observable<any> {
    console.log('🔧 Handling ScopeLocked error for resource:', resourceId);
    const resourceName = this.extractResourceNameFromId(resourceId);
    
    return new Observable(observer => {
      // First, get the locks to show detailed information
      this.getLocks(resourceId).subscribe({
        next: (locks) => {
          const lockData: LockConfirmationData = {
            resourceName,
            operationType,
            lockCount: locks.length,
            locks: locks.map(lock => ({
              name: lock.name,
              level: lock.level,
              notes: lock.notes
            }))
          };
          
          // Show detailed confirmation modal
          const modal = this.modal.create({
            nzContent: LockConfirmationModalComponent,
            nzData: { data: lockData },
            nzFooter: null,
            nzWidth: 600,
            nzClosable: false,
            nzMaskClosable: false
          });
          
          // Handle modal events
          const componentInstance = modal.getContentComponent();
          if (componentInstance) {
            componentInstance.visible = true;
            componentInstance.data = lockData;
            
            componentInstance.confirm.subscribe(() => {
              componentInstance.loading = true;
              
              // User confirmed, proceed with lock management workflow
              this.executeWithLockManagementObservable(resourceId, operation)
                .subscribe({
                  next: (result: any) => {
                    modal.destroy();
                    observer.next(result);
                    observer.complete();
                  },
                  error: (err: any) => {
                    componentInstance.loading = false;
                    modal.destroy();
                    observer.error(err);
                  }
                });
            });
            
            componentInstance.cancel.subscribe(() => {
              modal.destroy();
              observer.error(error);
            });
          }
        },
        error: (lockError) => {
          console.error('Failed to get locks for confirmation:', lockError);
          // Fallback to simple confirmation if we can't get lock details
          const modal = this.modal.confirm({
            nzTitle: 'Resource Lock Detected',
            nzContent: `
              <p>The resource "${resourceName}" is locked and cannot be modified.</p>
              <p>Would you like to temporarily remove the lock to perform the ${operationType}?</p>
              <p><strong>Note:</strong> The lock will be recreated after the operation completes.</p>
            `,
            nzOkText: 'Remove Lock & Continue',
            nzOkType: 'primary',
            nzOkDanger: true,
            nzCancelText: 'Cancel',
            nzOnOk: () => {
              this.executeWithLockManagementObservable(resourceId, operation)
                .subscribe({
                  next: (result: any) => {
                    observer.next(result);
                    observer.complete();
                  },
                  error: (err: any) => {
                    observer.error(err);
                  }
                });
            },
            nzOnCancel: () => {
              observer.error(error);
            }
          });
        }
      });
    });
  }

  /**
   * Execute operation with lock management workflow (Promise version)
   */
  private async executeWithLockManagement(resourceId: string, operation: () => Promise<any>): Promise<any> {
    console.log('🔄 Lock Management: Starting executeWithLockManagement for:', resourceId);
    
    try {
      // Step 1: Get existing locks
      console.log('📋 Lock Management: Step 1 - Getting existing locks');
      const existingLocks = await firstValueFrom(this.getLocks(resourceId));
      console.log('📋 Lock Management: Found locks:', existingLocks);
      
      // Step 2: Remove locks that prevent deletion
      console.log('🗑️ Lock Management: Step 2 - Removing locks');
      await firstValueFrom(this.removeLocks(existingLocks));
      console.log('✅ Lock Management: Locks removed successfully');
      
      // Step 3: Execute the main operation
      console.log('⚡ Lock Management: Step 3 - Executing main operation');
      const result = await operation();
      console.log('✅ Lock Management: Main operation completed successfully');
      
      // Step 4: Recreate the locks
      console.log('🔄 Lock Management: Step 4 - Recreating locks');
      await firstValueFrom(this.recreateLocks(resourceId, existingLocks));
      console.log('✅ Lock Management: Locks recreated successfully');
      
      console.log('🎉 Lock Management: Workflow completed successfully');
      return result;
    } catch (error) {
      console.error('❌ Lock Management: Error in workflow:', error);
      throw error;
    }
  }

  /**
   * Execute operation with lock management workflow (Observable version)
   */
  private executeWithLockManagementObservable(
    resourceId: string, 
    operation: () => Observable<any>
  ): Observable<any> {
    const loadingMessage = this.message.loading('Managing resource locks...', { nzDuration: 0 });
    
    return this.getLocks(resourceId).pipe(
      switchMap(locks => {
        const deleteLocks = locks.filter(lock => 
          lock.level === 'Delete' || lock.level === 'CanNotDelete'
        );
        
        if (deleteLocks.length === 0) {
          this.message.remove(loadingMessage.messageId);
          this.message.info('No delete locks found, proceeding with operation');
          return operation();
        }

        // Remove locks first
        return this.removeLocks(deleteLocks).pipe(
          switchMap(() => {
            this.message.remove(loadingMessage.messageId);
            const opMessage = this.message.loading('Performing operation...', { nzDuration: 0 });
            
            return operation().pipe(
              switchMap(result => {
                this.message.remove(opMessage.messageId);
                const recreateMessage = this.message.loading('Recreating locks...', { nzDuration: 0 });
                
                return this.recreateLocks(resourceId, deleteLocks).pipe(
                  map(() => {
                    this.message.remove(recreateMessage.messageId);
                    this.message.success('Operation completed successfully with lock management');
                    return result;
                  }),
                  catchError(lockError => {
                    this.message.remove(recreateMessage.messageId);
                    this.message.warning('Operation succeeded but some locks could not be recreated');
                    console.warn('Failed to recreate locks:', lockError);
                    return of(result);
                  })
                );
              }),
              catchError(opError => {
                this.message.remove(opMessage.messageId);
                const recreateMessage = this.message.loading('Recreating locks after failed operation...', { nzDuration: 0 });
                
                // Try to recreate locks even if operation failed
                return this.recreateLocks(resourceId, deleteLocks).pipe(
                  switchMap(() => {
                    this.message.remove(recreateMessage.messageId);
                    return throwError(() => opError);
                  }),
                  catchError(lockError => {
                    this.message.remove(recreateMessage.messageId);
                    this.message.error('Operation failed and locks could not be recreated');
                    console.error('Failed to recreate locks after operation failure:', lockError);
                    return throwError(() => opError);
                  })
                );
              })
            );
          }),
          catchError(lockRemovalError => {
            this.message.remove(loadingMessage.messageId);
            this.message.error('Failed to remove locks');
            return throwError(() => lockRemovalError);
          })
        );
      })
    );
  }

  /**
   * Get locks for a resource
   */
  private getLocks(resourceId: string): Observable<LockInfo[]> {
    console.log('📋 Lock Management: Getting locks for resource:', resourceId);
    
    return this.azureApiService.getStorageAccountLocks(resourceId).pipe(
      map(locks => {
        console.log('📋 Lock Management: Raw locks from API:', locks);
        const mappedLocks = locks.map(lock => ({
          id: lock.id,
          name: lock.name,
          level: lock.properties?.level || 'ReadOnly',
          notes: lock.properties?.notes
        }));
        const filteredLocks = mappedLocks.filter(lock => 
          lock.level === 'Delete' || lock.level === 'CanNotDelete'
        );
        console.log('📋 Lock Management: Filtered locks (Delete/CanNotDelete):', filteredLocks);
        return filteredLocks; // Return filtered locks, not all locks
      }),
      catchError(error => {
        console.error('Failed to get locks:', error);
        return of([]);
      })
    );
  }

  /**
   * Remove multiple locks
   */
  private removeLocks(locks: LockInfo[]): Observable<any> {
    console.log('🗑️ Lock Management: Removing locks:', locks);
    
    if (locks.length === 0) {
      console.log('📋 Lock Management: No locks to remove');
      return of(null);
    }

    const removeOperations = locks.map(lock => {
      console.log('🗑️ Lock Management: Deleting lock with ID:', lock.id);
      console.log('🗑️ Lock Management: Lock name:', lock.name);
      console.log('🗑️ Lock Management: Lock level:', lock.level);
      
      // Azure lock IDs are full resource paths like:
      // /subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Storage/storageAccounts/{accountName}/providers/Microsoft.Authorization/locks/{lockName}
      // The deleteStorageAccountLock method expects this full path
      return this.azureApiService.deleteStorageAccountLock(lock.id).pipe(
        tap(result => {
          console.log('✅ Lock Management: Successfully deleted lock:', lock.id, result);
          
          // Log successful lock removal
          this.appAuditService.logAction(
            'lock_removed',
            'storage_account',
            this.extractResourceIdFromLockId(lock.id),
            `Lock: ${lock.name}`,
            {
              lockId: lock.id,
              lockName: lock.name,
              lockLevel: lock.level === 'CanNotDelete' ? 'Delete' : lock.level as 'ReadOnly' | 'Delete',
              lockNotes: lock.notes
            },
            true
          );
        }),
        map(result => result),
        catchError(error => {
          console.error('❌ Lock Management: Failed to delete lock:', lock.id, error);
          console.error('❌ Lock Management: Error details:', {
            status: error.status,
            statusText: error.statusText,
            message: error.message,
            url: error.url
          });
          console.warn(`Failed to remove lock ${lock.name}:`, error);
          return of(null);
        })
      );
    });
    
    console.log('🗑️ Lock Management: Executing', removeOperations.length, 'delete requests');
    return forkJoin(removeOperations);
  }

  /**
   * Recreate locks on a resource
   */
  private recreateLocks(resourceId: string, locks: LockInfo[]): Observable<any> {
    const createOperations = locks.map(lock => 
      this.azureApiService.createStorageAccountLock(
        resourceId, 
        lock.name, 
        lock.level as 'ReadOnly' | 'Delete', 
        lock.notes || 'Recreated by Azure Permission Manager'
      ).pipe(
        tap(result => {
          // Log successful lock recreation
          this.appAuditService.logAction(
            'lock_added',
            'storage_account',
            resourceId,
            `Lock: ${lock.name}`,
            {
              lockName: lock.name,
              lockLevel: lock.level === 'CanNotDelete' ? 'Delete' : lock.level as 'ReadOnly' | 'Delete',
              lockNotes: lock.notes || 'Recreated by Azure Permission Manager',
              originalLockId: lock.id
            },
            true
          );
        }),
        catchError(error => {
          console.warn(`Failed to recreate lock ${lock.name}:`, error);
          return of(null);
        })
      )
    );
    
    return forkJoin(createOperations);
  }

  /**
   * Extract resource ID from lock ID
   */
  private extractResourceIdFromLockId(lockId: string): string {
    // Lock ID format: /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Storage/storageAccounts/{name}/providers/Microsoft.Authorization/locks/{lockName}
    const parts = lockId.split('/providers/Microsoft.Authorization/locks/');
    return parts.length > 0 ? parts[0] : lockId;
  }
}