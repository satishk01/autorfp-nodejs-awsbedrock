import React, { useState } from 'react';
import { Save, AlertCircle, CheckCircle } from 'lucide-react';

const Settings = () => {
  const [settings, setSettings] = useState({
    aws: {
      region: 'us-east-1',
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0'
    },
    upload: {
      maxFileSize: '50MB',
      allowedTypes: ['pdf', 'docx', 'txt', 'csv', 'xlsx']
    },
    processing: {
      retryAttempts: 3,
      timeout: 300000,
      enableStreaming: true
    },
    notifications: {
      emailNotifications: false,
      webhookUrl: ''
    }
  });

  const [saveStatus, setSaveStatus] = useState(null);

  const handleSettingChange = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const SettingSection = ({ title, children }) => (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  );

  const SettingField = ({ label, description, children }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {description && (
        <p className="text-sm text-gray-500 mb-2">{description}</p>
      )}
      {children}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure your RFP automation system
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {saveStatus === 'saving' ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </button>
      </div>

      {/* Save Status */}
      {saveStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Settings saved successfully
              </p>
            </div>
          </div>
        </div>
      )}

      {saveStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">
                Failed to save settings
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AWS Configuration */}
      <SettingSection title="AWS Configuration">
        <SettingField 
          label="AWS Region" 
          description="The AWS region where your Bedrock service is available"
        >
          <select
            value={settings.aws.region}
            onChange={(e) => handleSettingChange('aws', 'region', e.target.value)}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="us-east-1">US East (N. Virginia)</option>
            <option value="us-west-2">US West (Oregon)</option>
            <option value="eu-west-1">Europe (Ireland)</option>
            <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
          </select>
        </SettingField>

        <SettingField 
          label="Bedrock Model ID" 
          description="The Claude model to use for processing"
        >
          <select
            value={settings.aws.modelId}
            onChange={(e) => handleSettingChange('aws', 'modelId', e.target.value)}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="anthropic.claude-3-haiku-20240307-v1:0">Claude 3 Haiku</option>
            <option value="anthropic.claude-3-sonnet-20240229-v1:0">Claude 3 Sonnet</option>
            <option value="anthropic.claude-3-opus-20240229-v1:0">Claude 3 Opus</option>
          </select>
        </SettingField>
      </SettingSection>

      {/* File Upload Settings */}
      <SettingSection title="File Upload Settings">
        <SettingField 
          label="Maximum File Size" 
          description="Maximum size allowed for uploaded files"
        >
          <select
            value={settings.upload.maxFileSize}
            onChange={(e) => handleSettingChange('upload', 'maxFileSize', e.target.value)}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="10MB">10 MB</option>
            <option value="25MB">25 MB</option>
            <option value="50MB">50 MB</option>
            <option value="100MB">100 MB</option>
          </select>
        </SettingField>

        <SettingField 
          label="Allowed File Types" 
          description="File types that can be uploaded"
        >
          <div className="space-y-2">
            {['pdf', 'docx', 'txt', 'csv', 'xlsx', 'xls'].map(type => (
              <label key={type} className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.upload.allowedTypes.includes(type)}
                  onChange={(e) => {
                    const newTypes = e.target.checked
                      ? [...settings.upload.allowedTypes, type]
                      : settings.upload.allowedTypes.filter(t => t !== type);
                    handleSettingChange('upload', 'allowedTypes', newTypes);
                  }}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700 uppercase">{type}</span>
              </label>
            ))}
          </div>
        </SettingField>
      </SettingSection>

      {/* Processing Settings */}
      <SettingSection title="Processing Settings">
        <SettingField 
          label="Retry Attempts" 
          description="Number of times to retry failed operations"
        >
          <input
            type="number"
            min="1"
            max="10"
            value={settings.processing.retryAttempts}
            onChange={(e) => handleSettingChange('processing', 'retryAttempts', parseInt(e.target.value))}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </SettingField>

        <SettingField 
          label="Timeout (seconds)" 
          description="Maximum time to wait for each processing step"
        >
          <input
            type="number"
            min="60"
            max="1800"
            value={settings.processing.timeout / 1000}
            onChange={(e) => handleSettingChange('processing', 'timeout', parseInt(e.target.value) * 1000)}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </SettingField>

        <SettingField 
          label="Enable Streaming" 
          description="Enable real-time streaming of processing results"
        >
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.processing.enableStreaming}
              onChange={(e) => handleSettingChange('processing', 'enableStreaming', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            />
            <span className="ml-2 text-sm text-gray-700">Enable streaming updates</span>
          </label>
        </SettingField>
      </SettingSection>

      {/* Notification Settings */}
      <SettingSection title="Notifications">
        <SettingField 
          label="Email Notifications" 
          description="Receive email notifications when workflows complete"
        >
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.notifications.emailNotifications}
              onChange={(e) => handleSettingChange('notifications', 'emailNotifications', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            />
            <span className="ml-2 text-sm text-gray-700">Enable email notifications</span>
          </label>
        </SettingField>

        <SettingField 
          label="Webhook URL" 
          description="URL to receive webhook notifications (optional)"
        >
          <input
            type="url"
            value={settings.notifications.webhookUrl}
            onChange={(e) => handleSettingChange('notifications', 'webhookUrl', e.target.value)}
            placeholder="https://your-webhook-url.com/notifications"
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </SettingField>
      </SettingSection>

      {/* System Information */}
      <SettingSection title="System Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-500">Version</h4>
            <p className="text-sm text-gray-900">1.0.0</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500">Environment</h4>
            <p className="text-sm text-gray-900">Production</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500">Last Updated</h4>
            <p className="text-sm text-gray-900">{new Date().toLocaleDateString()}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500">Status</h4>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Healthy
            </span>
          </div>
        </div>
      </SettingSection>
    </div>
  );
};

export default Settings;