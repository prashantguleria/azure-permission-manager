import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzTagModule } from 'ng-zorro-antd/tag';

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [
    CommonModule,
    NzButtonModule,
    NzCardModule,
    NzGridModule,
    NzIconModule,
    NzTypographyModule,
    NzDividerModule,
    NzSpaceModule,
    NzTagModule
  ],
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.scss']
})
export class HomepageComponent {
  constructor(private router: Router) {}

  navigateToApp(): void {
    this.router.navigate(['/app']);
  }

  features = [
    {
      icon: 'user',
      title: 'User Management',
      description: 'Search, view, and manage Azure AD users and service principals with advanced filtering and bulk operations.'
    },
    {
      icon: 'safety-certificate',
      title: 'Permission Control',
      description: 'Assign and revoke storage account roles with precision, ensuring proper access control across your organization.'
    },
    {
      icon: 'lock',
      title: 'Resource Protection',
      description: 'Create, modify, and remove resource locks to prevent accidental changes to critical Azure resources.'
    },
    {
      icon: 'audit',
      title: 'Audit & Compliance',
      description: 'Comprehensive audit logs track all permission changes with detailed activity monitoring for compliance.'
    },
    {
      icon: 'cloud',
      title: 'Multi-Tenant Support',
      description: 'Seamlessly switch between different Azure tenants and manage permissions across multiple environments.'
    },
    {
      icon: 'mobile',
      title: 'Responsive Design',
      description: 'Modern, intuitive interface that works perfectly on desktop, tablet, and mobile devices.'
    }
  ];

  securityFeatures = [
    {
      icon: 'safety',
      title: 'Client-Side Only',
      text: 'Application runs entirely in your browser with no external servers'
    },
    {
      icon: 'eye-invisible',
      title: 'No Data Collection',
      text: 'We don\'t collect, store, or transmit your personal information'
    },
    {
      icon: 'home',
      title: 'Local Storage',
      text: 'Audit logs and preferences stored locally on your device'
    },
    {
      icon: 'api',
      title: 'Direct Azure Integration',
      text: 'Communicates exclusively with Microsoft Graph and Azure APIs'
    }
  ];
}