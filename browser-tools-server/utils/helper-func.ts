function isUrlMatch(pattern: string, url: string) {
    const regex = new RegExp(pattern);
    return regex.test(url);
}

export { isUrlMatch };


export function truncateString(str: string, maxLength: number) {
    return str.length > maxLength ? str.slice(0, maxLength) + '...' : str
}

// export function processWrapperRelatedData(data: any) {
//     let req, res
//     try {
//         req = data?.requestBody
//         res = data?.responseBody
//         const parsedBody = JSON.parse(req)
//         const parsedRes = JSON.parse(res)
//     } catch (error) {
//         return `Unhandled payload: ${data?.requestBody}`;
//     }

// }