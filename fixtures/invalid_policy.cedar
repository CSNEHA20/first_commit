// Malformed Cedar Policy Set
// Contains syntax errors for negative testing

permit (
    principal == User::"alice"
    action == Action::"view" // Missing comma delimiter
    resource == Invoice::"inv-1"
)
