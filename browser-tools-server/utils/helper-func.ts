function isUrlMatch(pattern: string, url: string) {
    const regex = new RegExp(pattern);
    return regex.test(url);
}

function truncateString(str: string, maxLength: number) {
    return str.length > maxLength ? str.slice(0, maxLength) + '...' : str
}

export { isUrlMatch, truncateString };