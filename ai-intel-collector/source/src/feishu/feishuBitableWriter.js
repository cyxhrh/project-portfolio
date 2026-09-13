const FIELD_TYPES = {
  text: 1,
  number: 2,
  single_select: 3,
  date: 5,
  checkbox: 7,
  url: 15
};

const FIELD_DEFINITIONS = [
  { name: "标题", type: "text" },
  { name: "来源", type: "single_select" },
  { name: "链接", type: "url" },
  { name: "分类", type: "single_select" },
  { name: "重要度", type: "number" },
  { name: "摘要类型", type: "single_select" },
  { name: "一句话摘要", type: "text" },
  { name: "为什么重要", type: "text" },
  { name: "项目启发", type: "text" },
  { name: "建议行动", type: "text" },
  { name: "是否建议深挖", type: "single_select" },
  { name: "置信度", type: "single_select" },
  { name: "采集日期", type: "text" },
  { name: "内容抓取状态", type: "single_select" },
  { name: "人工核验状态", type: "single_select" },
  { name: "原始 URL", type: "url" }
];

function toUrlField(value) {
  const text = String(value || "").trim();
  return text ? { text, link: text } : null;
}

function normalizeRecordFields(record) {
  const fields = record.fields || {};

  return {
    "标题": fields["标题"] || "",
    "来源": fields["来源"] || "",
    "链接": toUrlField(fields["链接"]),
    "分类": fields["分类"] || "",
    "重要度": fields["重要度"] || 0,
    "摘要类型": fields["摘要类型"] || "",
    "一句话摘要": fields["一句话摘要"] || "",
    "为什么重要": fields["为什么重要"] || "",
    "项目启发": fields["项目启发"] || "",
    "建议行动": fields["建议行动"] || "",
    "是否建议深挖": fields["是否建议深挖"] ? "是" : "否",
    "置信度": fields["置信度"] || "未知",
    "采集日期": fields["采集日期"] || "",
    "内容抓取状态": fields["内容抓取状态"] || "unknown",
    "人工核验状态": fields["人工核验状态"] || "待核验",
    "原始 URL": toUrlField(fields["链接"])
  };
}

async function createBitableApp(client, settings) {
  const body = {
    name: settings.bitableName
  };

  if (settings.docFolderToken) {
    body.folder_token = settings.docFolderToken;
  }

  const data = await client.request("POST", "/open-apis/bitable/v1/apps", body);
  return data.app || data;
}

async function listTables(client, appToken) {
  const data = await client.request("GET", `/open-apis/bitable/v1/apps/${appToken}/tables`, null, { page_size: 100 });
  return data.items || [];
}

async function createTable(client, appToken) {
  const data = await client.request("POST", `/open-apis/bitable/v1/apps/${appToken}/tables`, {
    table: {
      name: "真实 AI 摘要",
      default_view_name: "默认视图"
    }
  });

  return data.table || data;
}

async function ensureTable(client, appToken, configuredTableId) {
  if (configuredTableId) {
    return {
      table_id: configuredTableId,
      method: "env_table_id"
    };
  }

  const created = await createTable(client, appToken);
  return {
    table_id: created.table_id || created.id,
    method: "created"
  };
}

function fieldBody(definition) {
  const body = {
    field_name: definition.name,
    type: FIELD_TYPES[definition.type] || FIELD_TYPES.text
  };

  if (definition.type === "single_select") {
    body.property = {
      options: []
    };
  }

  return body;
}

async function createFields(client, appToken, tableId) {
  const results = [];

  for (const definition of FIELD_DEFINITIONS) {
    try {
      const data = await client.request(
        "POST",
        `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
        fieldBody(definition)
      );
      results.push({
        field: definition.name,
        status: "success",
        field_id: data.field?.field_id || data.field_id || ""
      });
    } catch (error) {
      results.push({
        field: definition.name,
        status: "failed",
        error
      });
    }
  }

  return results;
}

async function batchCreateRecords(client, appToken, tableId, records) {
  const payloadRecords = records.map((record) => ({
    fields: normalizeRecordFields(record)
  }));
  const data = await client.request(
    "POST",
    `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`,
    {
      records: payloadRecords
    }
  );

  return {
    status: "success",
    requested_count: payloadRecords.length,
    response_count: (data.records || []).length,
    response: data
  };
}

async function createTestBitableAndWriteRecords(client, settings, records) {
  try {
    if (!settings.bitableAppToken && !settings.docFolderToken) {
      return {
        status: "failed",
        step: "validate_bitable_target",
        app_token_present: false,
        table_id_present: false,
        error: "Missing FEISHU_DOC_FOLDER_TOKEN for creating a new test bitable, or FEISHU_BITABLE_APP_TOKEN for using an existing test bitable.",
        required_input: ["FEISHU_DOC_FOLDER_TOKEN", "or FEISHU_BITABLE_APP_TOKEN"],
        missing_permissions: ["多维表创建位置配置"]
      };
    }

    const app = settings.bitableAppToken
      ? { app_token: settings.bitableAppToken, method: "env_app_token" }
      : await createBitableApp(client, settings);
    const appToken = app.app_token || app.token;

    if (!appToken) {
      return {
        status: "failed",
        step: "create_bitable_app",
        error: "No app_token returned by Feishu."
      };
    }

    const table = await ensureTable(client, appToken, settings.bitableTableId);
    const tableId = table.table_id;

    if (!tableId) {
      return {
        status: "failed",
        step: "create_or_resolve_table",
        app_token_present: Boolean(appToken),
        error: "No table_id returned by Feishu."
      };
    }

    const fieldResults = await createFields(client, appToken, tableId);
    const failedFields = fieldResults.filter((result) => result.status !== "success");

    if (failedFields.length > 0) {
      return {
        status: "failed",
        step: "create_fields",
        app_token_present: Boolean(appToken),
        table_id_present: Boolean(tableId),
        field_results: fieldResults,
        missing_permissions: ["多维表字段创建权限"]
      };
    }

    const recordResult = await batchCreateRecords(client, appToken, tableId, records);

    return {
      status: "success",
      app_token_present: Boolean(appToken),
      table_id_present: Boolean(tableId),
      table_method: table.method,
      field_results: fieldResults,
      records: recordResult,
      dedupe_strategy: "test table is newly created; future production sync should dedupe by 原始 URL"
    };
  } catch (error) {
    return {
      status: "failed",
      step: "create_bitable_or_records",
      error,
      missing_permissions: ["多维表创建权限", "多维表记录写入权限"]
    };
  }
}

module.exports = {
  FIELD_DEFINITIONS,
  createTestBitableAndWriteRecords,
  normalizeRecordFields
};
