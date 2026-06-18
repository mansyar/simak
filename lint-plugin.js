// oxlint JS plugin — detect hardcoded UI strings that should use t('key')
// ESLint v9+ compatible API
// https://oxc.rs/docs/guide/usage/linter/js-plugins.html

/** Looks like English UI text: starts with uppercase, 2+ chars */
const UI_TEXT_RE = /^[A-Z][a-zA-Z' ,-]{2,}/;

/** Attributes that typically display user-visible text */
const UI_ATTRS = new Set(['placeholder', 'aria-label', 'title', 'alt']);

/** Strings that are intentionally hardcoded (confirmations, units, etc.) */
const ALLOWED_STRINGS = new Set(['DELETE']);

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Detect hardcoded UI strings that should use t("key") instead',
    },
    messages: {
      hardcodedText: `Hardcoded text "{{text}}" — use t('key') instead`,
      hardcodedAttr: `Hardcoded {{attr}}="{{text}}" — use t('key') instead`,
    },
  },
  create(context) {
    return {
      JSXText(node) {
        const text = node.value.trim();
        if (
          text &&
          !ALLOWED_STRINGS.has(text) &&
          UI_TEXT_RE.test(text)
        ) {
          context.report({
            node,
            messageId: 'hardcodedText',
            data: { text },
          });
        }
      },
      JSXAttribute(node) {
        const attrName = typeof node.name === 'object' && node.name !== null
          ? /** @type {{ name: string }} */ (node.name).name
          : undefined;

        if (!attrName || !UI_ATTRS.has(attrName)) return;
        if (!node.value || node.value.type !== 'Literal') return;
        if (typeof node.value.value !== 'string') return;

        const val = node.value.value.trim();
        if (val && !ALLOWED_STRINGS.has(val) && /[A-Za-z]/.test(val[0]) && val.length > 2) {
          context.report({
            node,
            messageId: 'hardcodedAttr',
            data: { attr: attrName, text: val },
          });
        }
      },
    };
  },
};

/** @type {import('eslint').ESLint.Plugin} */
export default {
  meta: { name: 'simak-i18n' },
  rules: { 'no-hardcoded': rule },
};
