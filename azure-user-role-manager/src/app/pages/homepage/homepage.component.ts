import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-homepage',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.scss'
})
export class HomepageComponent {
  private readonly router = inject(Router);

  navigateToApp(): void {
    this.router.navigate(['/app']);
  }

  readonly features = [
    {
      icon: 'users',
      iconClass: 'icon-blue',
      title: 'User Management',
      description: 'Search, view, and manage Azure AD users and service principals with advanced filtering and bulk operations.'
    },
    {
      icon: 'shield',
      iconClass: 'icon-blue',
      title: 'Permission Control',
      description: 'Assign and revoke storage account roles with precision, ensuring proper access control across your organization.'
    },
    {
      icon: 'lock',
      iconClass: 'icon-blue',
      title: 'Resource Protection',
      description: 'Create, modify, and remove resource locks to prevent accidental changes to critical Azure resources.'
    },
    {
      icon: 'file',
      iconClass: 'icon-orange',
      title: 'Audit & Compliance',
      description: 'Comprehensive audit logs track all permission changes with detailed activity monitoring for compliance.'
    },
    {
      icon: 'globe',
      iconClass: 'icon-purple',
      title: 'Multi-Tenant Support',
      description: 'Seamlessly switch between different Azure tenants and manage permissions across multiple environments.'
    },
    {
      icon: 'desktop',
      iconClass: 'icon-green',
      title: 'Responsive Design',
      description: 'Modern, intuitive interface that works perfectly on desktop, tablet, and mobile devices.'
    }
  ];

  readonly securityFeatures = [
    {
      icon: 'shield',
      title: 'Client-Side Only',
      text: 'Runs entirely in your browser with no external servers'
    },
    {
      icon: 'eye-slash',
      title: 'No Data Collection',
      text: "We don't collect, store, or transmit your information"
    },
    {
      icon: 'database',
      title: 'Local Storage',
      text: 'Audit logs and preferences stored locally on your device'
    },
    {
      icon: 'globe',
      title: 'Direct Azure APIs',
      text: 'Communicates exclusively with Microsoft Graph and Azure'
    }
  ];

  readonly privacyPoints = [
    'All audit logs stored in your browser\'s local storage',
    'Clear your data anytime with a single click',
    'No tracking, analytics, or third-party data sharing',
    'Direct communication with Microsoft Azure APIs only'
  ];
}
