"""A small T-SQL tokenizer for the agent-side checks.

Comments and string literals are recognised so that keywords inside them do not count, and keywords
hidden by comments (``DE/**/LETE`` is two words, ``/**/DELETE`` is one) cannot slip through. This is
not a parser: core-backend's ScriptDom check (ADR-0004) is the enforcing layer.
"""

from dataclasses import dataclass
from enum import StrEnum


class TokenKind(StrEnum):
    """Kinds of tokens."""

    WORD = "word"  # unquoted identifier or keyword
    QUOTED = "quoted"  # [identifier] or "identifier"
    STRING = "string"  # 'literal' or N'literal'
    NUMBER = "number"
    VARIABLE = "variable"  # @name or @@name
    PUNCT = "punct"


@dataclass(frozen=True)
class Token:
    """One token. ``value`` is the identifier text without quotes, or the literal source text."""

    kind: TokenKind
    value: str
    offset: int

    @property
    def upper(self) -> str:
        """Upper-case value, for keyword comparison."""
        return self.value.upper()

    def is_word(self, *words: str) -> bool:
        """Return whether this is an unquoted word equal to one of ``words`` (case-insensitive)."""
        return self.kind is TokenKind.WORD and self.upper in words

    def is_punct(self, value: str) -> bool:
        """Return whether this is the punctuation ``value``."""
        return self.kind is TokenKind.PUNCT and self.value == value

    @property
    def is_identifier(self) -> bool:
        """Return whether this is a word or a quoted identifier."""
        return self.kind in (TokenKind.WORD, TokenKind.QUOTED)


class TokenizeError(ValueError):
    """The text cannot be tokenized (unterminated comment, string or quoted identifier)."""


_WORD_START = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_#")
_WORD_PART = _WORD_START | set("0123456789$@")
_DIGITS = set("0123456789")


def _is_word_start(char: str) -> bool:
    return char in _WORD_START or (char.isalpha() and not char.isascii())


def _is_word_part(char: str) -> bool:
    return char in _WORD_PART or (char.isalnum() and not char.isascii())


def tokenize(sql: str) -> list[Token]:
    """Split ``sql`` into tokens, dropping whitespace (any Unicode space) and comments."""
    tokens: list[Token] = []
    i, n = 0, len(sql)
    while i < n:
        char = sql[i]
        if char.isspace() or char in "﻿​":
            i += 1
        elif sql.startswith("--", i):
            end = sql.find("\n", i)
            i = n if end == -1 else end + 1
        elif sql.startswith("/*", i):
            i = _skip_block_comment(sql, i)
        elif char == "'" or (char in "nN" and sql.startswith("'", i + 1)):
            start = i
            i = _end_of_quoted(sql, i + (1 if char == "'" else 2), "'")
            tokens.append(Token(TokenKind.STRING, sql[start:i], start))
        elif char == "[":
            end = _end_of_quoted(sql, i + 1, "]")
            tokens.append(Token(TokenKind.QUOTED, sql[i + 1 : end - 1].replace("]]", "]"), i))
            i = end
        elif char == '"':
            end = _end_of_quoted(sql, i + 1, '"')
            tokens.append(Token(TokenKind.QUOTED, sql[i + 1 : end - 1].replace('""', '"'), i))
            i = end
        elif char == "@":
            start = i
            i += 2 if sql.startswith("@@", i) else 1
            while i < n and _is_word_part(sql[i]):
                i += 1
            tokens.append(Token(TokenKind.VARIABLE, sql[start:i], start))
        elif char in _DIGITS or (char == "." and i + 1 < n and sql[i + 1] in _DIGITS):
            start = i
            while i < n and (sql[i] in _DIGITS or sql[i] in ".eE"):
                i += 1
            tokens.append(Token(TokenKind.NUMBER, sql[start:i], start))
        elif _is_word_start(char):
            start = i
            while i < n and _is_word_part(sql[i]):
                i += 1
            tokens.append(Token(TokenKind.WORD, sql[start:i], start))
        else:
            tokens.append(Token(TokenKind.PUNCT, char, i))
            i += 1
    return tokens


def _skip_block_comment(sql: str, start: int) -> int:
    """T-SQL block comments nest."""
    depth, i = 0, start
    while i < len(sql):
        if sql.startswith("/*", i):
            depth += 1
            i += 2
        elif sql.startswith("*/", i):
            depth -= 1
            i += 2
            if depth == 0:
                return i
        else:
            i += 1
    raise TokenizeError("unterminated block comment")


def _end_of_quoted(sql: str, i: int, quote: str) -> int:
    """Index after the closing ``quote``; a doubled quote is an escaped quote."""
    while i < len(sql):
        if sql[i] == quote:
            if sql.startswith(quote * 2, i):
                i += 2
                continue
            return i + 1
        i += 1
    raise TokenizeError(f"unterminated {quote} quote")
