function categorizeItem(item, categories) {
  const text = `${item.title || ""} ${item.summary_placeholder || ""} ${item.source_name || ""}`.toLowerCase();
  const fallback = categories.find((category) => category.id === "other") || {
    name: "其他",
    default_importance: "low"
  };

  for (const category of categories) {
    if (category.id === "other") {
      continue;
    }

    const matched = category.keywords.some((keyword) => text.includes(keyword.toLowerCase()));
    if (matched) {
      return {
        category: category.name,
        importance: category.default_importance
      };
    }
  }

  return {
    category: fallback.name,
    importance: fallback.default_importance
  };
}

module.exports = {
  categorizeItem
};
