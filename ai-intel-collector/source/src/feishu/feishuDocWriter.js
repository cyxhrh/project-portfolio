function findSpaceByName(spaces, name) {
  return spaces.find((space) => space.name === name || space.space_name === name);
}

async function listWikiSpaces(client) {
  const data = await client.request("GET", "/open-apis/wiki/v2/spaces", null, { page_size: 50 });
  return data.items || [];
}

async function resolveWikiSpace(client, settings) {
  if (settings.wikiSpaceId) {
    return {
      status: "success",
      space: {
        space_id: settings.wikiSpaceId,
        name: settings.wikiSpaceName || "provided_space_id"
      },
      method: "env_space_id"
    };
  }

  const spaces = await listWikiSpaces(client);
  const matched = findSpaceByName(spaces, settings.wikiSpaceName);

  if (!matched) {
    return {
      status: "failed",
      error: `Cannot find wiki space by name: ${settings.wikiSpaceName}`,
      required_input: ["FEISHU_WIKI_SPACE_ID", "FEISHU_WIKI_PARENT_NODE_TOKEN", "knowledge base URL"]
    };
  }

  return {
    status: "success",
    space: matched,
    method: "space_name_lookup"
  };
}

function extractNode(data) {
  return data.node || data;
}

async function createWikiNode(client, { spaceId, parentNodeToken, title, objType }) {
  const body = {
    obj_type: objType,
    node_type: "origin",
    title
  };

  if (parentNodeToken) {
    body.parent_node_token = parentNodeToken;
  }

  const data = await client.request("POST", `/open-apis/wiki/v2/spaces/${spaceId}/nodes`, body);
  return extractNode(data);
}

function markdownToPlainTextBlocks(markdown) {
  const chunks = [];
  const maxLength = 1800;
  let remaining = markdown;

  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, maxLength));
    remaining = remaining.slice(maxLength);
  }

  return chunks.map((text) => ({
    block_type: 2,
    text: {
      elements: [
        {
          text_run: {
            content: text
          }
        }
      ]
    }
  }));
}

async function writeMarkdownToDocx(client, documentId, markdown) {
  const blocks = markdownToPlainTextBlocks(markdown);
  const data = await client.request(
    "POST",
    `/open-apis/docx/v1/documents/${documentId}/blocks/${documentId}/children`,
    {
      children: blocks
    }
  );

  return {
    status: "success",
    block_count: blocks.length,
    response: data
  };
}

async function createTestWikiDocument(client, settings, documentPayload) {
  const title = `[TEST] ${documentPayload.title}`;
  const resolvedSpace = await resolveWikiSpace(client, settings);

  if (resolvedSpace.status !== "success") {
    return {
      status: "failed",
      title,
      step: "resolve_wiki_space",
      error: resolvedSpace.error,
      required_input: resolvedSpace.required_input
    };
  }

  try {
    const node = await createWikiNode(client, {
      spaceId: resolvedSpace.space.space_id,
      parentNodeToken: settings.wikiParentNodeToken,
      title,
      objType: "docx"
    });
    const documentId = node.obj_token || node.document_id || node.token;
    let contentWrite = {
      status: "skipped",
      reason: "document_id_not_returned"
    };

    if (documentId) {
      try {
        contentWrite = await writeMarkdownToDocx(client, documentId, documentPayload.markdown_content);
      } catch (error) {
        contentWrite = {
          status: "failed",
          error
        };
      }
    }

    return {
      status: "success",
      title,
      space_id: resolvedSpace.space.space_id,
      node_token: node.node_token || node.token || "",
      document_id: documentId || "",
      url: node.url || "",
      content_write: contentWrite
    };
  } catch (error) {
    return {
      status: "failed",
      title,
      step: "create_wiki_docx_node",
      error,
      missing_permissions: ["文档创建权限", "知识库写入权限"]
    };
  }
}

module.exports = {
  createTestWikiDocument,
  resolveWikiSpace,
  listWikiSpaces,
  markdownToPlainTextBlocks
};
