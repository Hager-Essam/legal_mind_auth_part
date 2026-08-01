# Exact legal references

The parser recognizes Arabic/Western digits and structured article, paragraph,
clause, law, appeal, and judicial-year references. Article ranges are expanded
with a large safety cap; callers should still constrain request size.

For each requested article, lookup requires a parent (`child_index` -1/null),
Egyptian jurisdiction, `is_retrievable=true`, `reviewStatus=published`, and an
eligible authority status. Identity matching proceeds:

1. exact `authorityTitleNormalized`;
2. exact `law_number` and `law_year` when supplied;
3. escaped ordered-word regex against the normalized title, accepted only if
   candidates identify one authority.

The third step is fuzzy, not exact. The longest parent is selected; governed
children are loaded in `child_index` order. Appeal lookup uses appeal number and
optional judicial year with the same governance policy.

A found result is rendered directly by `LegalRefService`; no grounding,
citation validator, or LLM runs and `llm_provider_used` is null. Multi-article
requests can return partial success plus a list of missing articles. If no exact
article/ruling is found, the request falls through to semantic RAG with a
visible prefix.

Direct answer display currently depends partly on `law_name`; official titles
remain the canonical citation field. Some extra answer-builder methods and
chapter/part patterns have no caller.
