const vscode = require('vscode');
const { hostOf, authFor } = require('./confluenceClient');
const { configuredToken, configuredEmail } = require('./config');

async function showTokenSettingsError(host) {
  const open = 'Open Settings';
  const picked = await vscode.window.showErrorMessage(
    'No Confluence token for ' + host + ' — set confluenceToMd.token in the extension settings.',
    open);
  if (picked === open) {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'confluenceToMd.token');
  }
}

async function credentialsFor(site) {
  const token = configuredToken();
  if (!token) {
    await showTokenSettingsError(hostOf(site.origin));
    return null;
  }
  return authFor(site, token, configuredEmail());
}

module.exports = { credentialsFor };
