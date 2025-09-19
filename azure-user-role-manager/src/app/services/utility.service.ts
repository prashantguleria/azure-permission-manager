import { Injectable } from '@angular/core';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UtilityService {

  constructor() { }

  /**
   * Get user initials from display name or user object
   * @param input - User object or display name string
   * @returns User initials (up to 2 characters)
   */
  getUserInitials(input: User | string | null | undefined): string {
    let displayName: string;
    
    if (!input) {
      return 'U';
    }
    
    if (typeof input === 'string') {
      displayName = input;
    } else if (typeof input === 'object' && input.displayName) {
      displayName = input.displayName;
    } else {
      return 'U';
    }
    
    if (!displayName || displayName.trim() === '') {
      return 'U';
    }
    
    const names = displayName.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    } else {
      return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    }
  }

  /**
   * Format date to readable string
   * @param date - Date to format
   * @returns Formatted date string
   */
  formatDate(date: Date | string | null | undefined): string {
    if (!date) {
      return 'N/A';
    }
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Get role type color for display
   * @param roleType - Role type string
   * @returns Color string for the role type
   */
  getRoleTypeColor(roleType: string | undefined): string {
    if (!roleType) {
      return 'default';
    }
    
    switch (roleType.toLowerCase()) {
      case 'builtin':
        return 'blue';
      case 'custom':
        return 'green';
      case 'privileged':
        return 'red';
      default:
        return 'default';
    }
  }

  /**
   * Get status color based on enabled state
   * @param isEnabled - Whether the user/item is enabled
   * @returns Color string for the status
   */
  getStatusColor(isEnabled: boolean | undefined): string {
    return isEnabled ? 'success' : 'error';
  }

  /**
   * Get status text based on enabled state
   * @param isEnabled - Whether the user/item is enabled
   * @returns Status text
   */
  getStatusText(isEnabled: boolean | undefined): string {
    return isEnabled ? 'Active' : 'Inactive';
  }

  /**
   * Track by function for ngFor optimization
   * @param index - Array index
   * @param item - Item with id property
   * @returns Unique identifier for tracking
   */
  trackById(index: number, item: { id: string }): string {
    return item.id;
  }

  /**
   * Track by role id for role assignments
   * @param index - Array index
   * @param role - Role assignment item
   * @returns Unique identifier for tracking
   */
  trackByRoleId(index: number, role: any): string {
    return role.id || index.toString();
  }
}