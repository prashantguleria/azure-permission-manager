# Azure User Role Manager

## 🔐 Secure Azure Permission Management

A professional, client-side application for managing Azure Active Directory users, service principals, and storage account permissions. Built with security and privacy as core principles.

## 🌟 Key Features

### User Management
- **Advanced Search**: Find users and service principals with intelligent filtering
- **Detailed Profiles**: View comprehensive user information and account status
- **Bulk Operations**: Efficiently manage multiple users simultaneously

### Permission Control
- **Role Assignment**: Assign storage account roles with precision
- **Permission Revocation**: Remove access rights safely and efficiently
- **Multi-Tenant Support**: Seamlessly switch between Azure tenants

### Resource Protection
- **Resource Locks**: Create, modify, and remove locks on critical resources
- **Access Control**: Prevent unauthorized changes to important assets
- **Compliance Tools**: Maintain organizational security standards

### Audit & Monitoring
- **Comprehensive Logging**: Track all permission changes with detailed records
- **Activity Monitoring**: Real-time visibility into user actions
- **Compliance Reports**: Generate audit trails for regulatory requirements

## 🛡️ Security & Privacy

### Zero Server Architecture
- **Client-Side Only**: Application runs entirely in your browser
- **No External Servers**: No data passes through third-party infrastructure
- **Direct Azure Integration**: Communicates exclusively with Microsoft APIs

### Data Protection
- **No Data Collection**: We don't collect, store, or transmit personal information
- **Local Storage Only**: Audit logs and preferences stored on your device
- **User Control**: You maintain complete control over your data
- **GDPR Compliant**: Designed with privacy regulations in mind

### Authentication Security
- **Microsoft Authentication**: Uses official Microsoft Authentication Library (MSAL)
- **Token Security**: Secure token handling with automatic refresh
- **Tenant Isolation**: Proper separation between different Azure tenants

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Azure Active Directory account with appropriate permissions
- Access to Azure tenants you want to manage

### Quick Start
1. **Visit the Application**: Navigate to the deployed application URL
2. **Sign In**: Use your Azure AD credentials to authenticate
3. **Select Tenant**: Choose the Azure tenant you want to manage
4. **Start Managing**: Begin managing users and permissions immediately

### Required Azure Permissions
To use all features, your account needs:
- `User.Read.All` - Read user profiles
- `Directory.Read.All` - Read directory data
- `RoleManagement.ReadWrite.Directory` - Manage role assignments
- `Application.Read.All` - Read service principal information

## 🏗️ Technical Architecture

### Frontend Technology
- **Angular 17**: Modern, reactive web framework
- **TypeScript**: Type-safe development
- **PrimeNG**: Professional UI components with modern design
- **SCSS**: Advanced styling capabilities

### Azure Integration
- **Microsoft Graph API**: User and directory management
- **Azure Resource Manager**: Resource and permission management
- **MSAL Angular**: Secure authentication flows

### Development Features
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Progressive Web App**: Installable and offline-capable
- **Modern Browser Support**: Optimized for current web standards

## 📱 User Interface

### Professional Design
- **Clean Layout**: Minimal, distraction-free interface
- **Intuitive Navigation**: Easy-to-use menu and breadcrumb system
- **Responsive Grid**: Adapts to any screen size
- **Accessibility**: WCAG compliant for inclusive access

### User Experience
- **Fast Performance**: Optimized loading and rendering
- **Real-time Updates**: Live data synchronization
- **Error Handling**: Graceful error messages and recovery
- **Keyboard Navigation**: Full keyboard accessibility support

## 🔧 Development

### Local Development
```bash
# Clone the repository
git clone <repository-url>
cd azure-user-role-manager

# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

### Environment Setup
1. Configure Azure App Registration
2. Set up redirect URIs for your domain
3. Configure API permissions
4. Update environment configuration

## 📋 Compliance & Governance

### Security Standards
- **Zero Trust Architecture**: Never trust, always verify
- **Principle of Least Privilege**: Minimal required permissions
- **Audit Trail**: Complete activity logging
- **Data Minimization**: Only necessary data processing

### Regulatory Compliance
- **GDPR Ready**: European data protection compliance
- **SOC 2 Aligned**: Security and availability controls
- **ISO 27001 Principles**: Information security management

## 🤝 Support & Contributing

### Getting Help
- Review the built-in help documentation
- Check Azure AD permissions and configuration
- Verify network connectivity to Microsoft services

### Best Practices
- Regularly review and audit permissions
- Use resource locks for critical resources
- Monitor audit logs for unusual activity
- Keep browser and application updated

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Links

- [Microsoft Graph API Documentation](https://docs.microsoft.com/en-us/graph/)
- [Azure Resource Manager Documentation](https://docs.microsoft.com/en-us/azure/azure-resource-manager/)
- [MSAL Angular Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-angular)

---

**Built with ❤️ for Azure administrators who value security and efficiency.**