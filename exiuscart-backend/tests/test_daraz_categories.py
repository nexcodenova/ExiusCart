"""Daraz's real category tree is arbitrarily deep and only leaf categories
can actually be used to list a product — _flatten_daraz_categories turns
that nested tree into a flat, breadcrumb-named list. Pure function, no
database or network needed."""
from app.api.v1.endpoints.daraz import _flatten_daraz_categories


def test_flattens_nested_tree_to_leaves_only_with_breadcrumb_names():
    tree = [
        {
            "category_id": 1,
            "name": "Bags and Travel",
            "leaf": False,
            "children": [
                {
                    "category_id": 2,
                    "name": "Kids Bags",
                    "leaf": False,
                    "children": [
                        {"category_id": 3, "name": "Backpacks", "leaf": True, "children": []},
                    ],
                },
                {"category_id": 4, "name": "Adult Bags", "leaf": True, "children": []},
            ],
        },
    ]

    result = _flatten_daraz_categories(tree)

    assert result == [
        {"category_id": 3, "name": "Bags and Travel > Kids Bags > Backpacks"},
        {"category_id": 4, "name": "Bags and Travel > Adult Bags"},
    ]


def test_top_level_leaf_has_no_breadcrumb_prefix():
    tree = [{"category_id": 5, "name": "Smart Phones", "leaf": True, "children": []}]

    result = _flatten_daraz_categories(tree)

    assert result == [{"category_id": 5, "name": "Smart Phones"}]


def test_empty_tree_returns_empty_list():
    assert _flatten_daraz_categories([]) == []
    assert _flatten_daraz_categories(None) == []
