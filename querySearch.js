export default function querySearch(offset, limit, queryText, queryParams) {
    let queryModified = queryText;

    if (offset) {
        queryParams.push(offset);
        queryModified += ` ORDER BY id OFFSET $${queryParams.length} ROWS`;
    }
    if (limit) {
        queryParams.push(limit);
        queryModified += ` LIMIT $${queryParams.length}`;
    }
    return queryModified;
}
