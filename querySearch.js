export default function querySearch(
    offset,
    limit,
    queryText,
    queryParams,
    order
) {
    let queryModified = queryText;
    if (order) {
        const regex = /^(select|insert|update|delete)/i;
        const isOrderAQuery = regex.test(order);
        if (!isOrderAQuery) {
            if (queryModified.toLowerCase().includes("order by")) {
                const orderByRegex = /(?<=ORDER BY)\s([\w.]+)/gi; //regex to capture the word in front of the ORDER BY command
                queryModified = queryModified.replace(
                    orderByRegex,
                    ` ${order}`
                );
            } else {
                queryModified += ` ORDER BY ${order}`;
            }
        }
    }
    if (offset) {
        queryParams.push(offset);
        queryModified += ` OFFSET $${queryParams.length} ROWS`;
    }
    if (limit) {
        queryParams.push(limit);
        queryModified += ` LIMIT $${queryParams.length}`;
    }
    return queryModified;
}
