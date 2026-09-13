const axios = require("axios");

const BASE_URL = "https://open.feishu.cn";

function boolFromEnv(value) {
  return String(value || "").toLowerCase() === "true";
}

function hasValue(value) {
  return Boolean(String(value || "").trim());
}

function sanitizeError(error) {
  if (error.response) {
    return {
      type: "http_error",
      status: error.response.status,
      code: error.response.data?.code,
      msg: error.response.data?.msg || error.response.data?.error || error.message
    };
  }

  return {
    type: "request_error",
    msg: error.message
  };
}

function loadFeishuSettings(env = process.env) {
  return {
    appId: env.FEISHU_APP_ID || "",
    appSecret: env.FEISHU_APP_SECRET || "",
    syncEnabled: boolFromEnv(env.FEISHU_SYNC_ENABLED),
    targetEnv: env.FEISHU_TARGET_ENV || "test",
    docTargetType: env.FEISHU_DOC_TARGET_TYPE || "wiki",
    wikiSpaceName: env.FEISHU_WIKI_SPACE_NAME || "AI一手信息",
    wikiSpaceId: env.FEISHU_WIKI_SPACE_ID || "",
    wikiParentNodeToken: env.FEISHU_WIKI_PARENT_NODE_TOKEN || "",
    docFolderToken: env.FEISHU_DOC_FOLDER_TOKEN || "",
    bitableName: env.FEISHU_BITABLE_NAME || "[TEST] AI 一手情报库",
    bitableAppToken: env.FEISHU_BITABLE_APP_TOKEN || "",
    bitableTableId: env.FEISHU_BITABLE_TABLE_ID || ""
  };
}

function describeFeishuSettings(settings) {
  return {
    app_id_present: hasValue(settings.appId),
    app_secret_present: hasValue(settings.appSecret),
    sync_enabled: settings.syncEnabled,
    target_env: settings.targetEnv,
    doc_target_type: settings.docTargetType,
    wiki_space_name_present: hasValue(settings.wikiSpaceName),
    wiki_space_id_present: hasValue(settings.wikiSpaceId),
    wiki_parent_node_token_present: hasValue(settings.wikiParentNodeToken),
    doc_folder_token_present: hasValue(settings.docFolderToken),
    bitable_name_present: hasValue(settings.bitableName),
    bitable_app_token_present: hasValue(settings.bitableAppToken),
    bitable_table_id_present: hasValue(settings.bitableTableId)
  };
}

function validateDryRunSettings(settings) {
  const missing = [];

  if (!hasValue(settings.appId)) missing.push("FEISHU_APP_ID");
  if (!hasValue(settings.appSecret)) missing.push("FEISHU_APP_SECRET");
  if (!hasValue(settings.targetEnv)) missing.push("FEISHU_TARGET_ENV");
  if (!hasValue(settings.wikiSpaceName) && !hasValue(settings.wikiSpaceId)) {
    missing.push("FEISHU_WIKI_SPACE_NAME or FEISHU_WIKI_SPACE_ID");
  }

  return missing;
}

function validateTestRunSafety(settings) {
  const blockers = [];

  if (!settings.syncEnabled) blockers.push("FEISHU_SYNC_ENABLED is not true");
  if (settings.targetEnv !== "test") blockers.push("FEISHU_TARGET_ENV is not test");
  blockers.push(...validateDryRunSettings(settings));

  return blockers;
}

class FeishuClient {
  constructor(settings) {
    this.settings = settings;
    this.tenantAccessToken = null;
    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: 30000
    });
  }

  async getTenantAccessToken() {
    const response = await this.http.post("/open-apis/auth/v3/tenant_access_token/internal", {
      app_id: this.settings.appId,
      app_secret: this.settings.appSecret
    });

    if (response.data.code !== 0) {
      throw new Error(`tenant_access_token_failed: ${response.data.code} ${response.data.msg}`);
    }

    this.tenantAccessToken = response.data.tenant_access_token;
    return this.tenantAccessToken;
  }

  tokenPresent() {
    return hasValue(this.tenantAccessToken);
  }

  async request(method, url, data, params) {
    try {
      const response = await this.http.request({
        method,
        url,
        data,
        params,
        headers: {
          Authorization: `Bearer ${this.tenantAccessToken}`
        }
      });

      if (response.data?.code !== 0) {
        throw {
          response: {
            status: response.status,
            data: response.data
          }
        };
      }

      return response.data.data || {};
    } catch (error) {
      throw sanitizeError(error);
    }
  }
}

module.exports = {
  FeishuClient,
  loadFeishuSettings,
  describeFeishuSettings,
  validateDryRunSettings,
  validateTestRunSafety,
  sanitizeError,
  hasValue
};
