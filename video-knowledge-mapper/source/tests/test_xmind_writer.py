from __future__ import annotations

import json
import zipfile

from vkm.core.mindmap import MindmapDocument, MindmapNode
from vkm.core.xmind_writer import write_xmind_file


def test_write_xmind_file_creates_openable_archive(tmp_path) -> None:
    document = MindmapDocument(
        title="学习地图",
        branches=(
            MindmapNode("核心概念", (MindmapNode("概念一"),)),
            MindmapNode("操作流程"),
            MindmapNode("注意事项"),
        ),
    )

    path = write_xmind_file(tmp_path, document, stem="sample")

    assert path.name == "sample.xmind"
    assert path.exists()
    with zipfile.ZipFile(path) as archive:
        assert {"content.json", "metadata.json", "manifest.json"}.issubset(
            set(archive.namelist())
        )
        content = json.loads(archive.read("content.json").decode("utf-8"))

    assert content[0]["rootTopic"]["title"] == "学习地图"
    attached = content[0]["rootTopic"]["children"]["attached"]
    assert len(attached) == 3
    assert attached[0]["children"]["attached"][0]["title"] == "概念一"
