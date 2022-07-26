function objectToURI(input) {
    let res = "?"
    const keys = Object.keys(input)
    keys.forEach((key, index) => {
        res += encodeURIComponent(key) + "=" + encodeURIComponent(input[key])
        if (index + 1 !== keys.length) res += "&"
    })
    return res
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

module.exports = {
    objectToURI,
    delay
}