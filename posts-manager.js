/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// This script runs on posts.html
/** Like PublicPromise, but limits to only one task being able to await it */
class PublicPromiseSingle {
    locked
    resolve
    reject
    #promise
    constructor() {
        this.#promise = new Promise((resolve, reject) => {
            this.resolve = resolve
            this.reject = reject
        })
        this.locked = false
    }

    async acquireAwaitPromise() {
        if (this.locked) {
            throw new Error("This promise is already being awaited.")
        }
        this.locked = true
        try {
            const result = await this.#promise
            this.locked = false
            return result
        }
        catch (error) {
            this.locked = false
            throw error
        }
    }
}

class PostElArray {
    items
    constructor() {
        this.items = []
    }

    orderedInsert(postEl, comparisonFn) {
        let insertIndex = this.items.findIndex(existingItem => existingItem.post.id === postEl.post?.id)
        if (insertIndex >= 0) {
            this.items[insertIndex] = postEl
        }
        else {
            insertIndex = this.items.findIndex(existingItem => comparisonFn(postEl, existingItem) < 0)
            if (insertIndex === -1) {
                this.items.push(postEl)
                insertIndex = this.items.length - 1
            }
            else {
                this.items.splice(insertIndex, 0, postEl)
            }
        }
        return insertIndex
    }

    delete(postEl) {
      this.items = this.items.filter(existingItem => existingItem.post.id !== postEl.post?.id)
    }

    includes(postEl) {
      return this.items.some(existingItem => existingItem.post.id === postEl.post?.id)
    }

    getById(id) {
        return this.items.find(postEl => postEl.post?.id === id)
    }

    clear() {
        this.items.length = 0
    }
}

let topUpvotes = 0
let topDate = new Date(0)
let bottomUpvotes = 0xFFFFFFFF
let bottomDate = new Date()

const postEls = new PostElArray()
const contentsBaseLength = contents.childNodes.length
const postLimit = 16
const postLoadCooldown = 1000
let postFinishedLastLoad = null
let filter = postsSortSelect.value // "upvotes" | "date"
let hideSensitive = !!postsHideSensitive.checked

function insertElementAtIndex(parentElement, newElement, index) {
    const referenceElement = parentElement.childNodes[index]
    if (referenceElement) {
        parentElement.insertBefore(newElement, referenceElement)
    }
    else {
        parentElement.appendChild(newElement)
    }
}

async function finishPostLoadWithCd() {
    await new Promise(resolve => setTimeout(resolve, postLoadCooldown))
    postFinishedLastLoad.resolve()
}
async function tryLoadPosts(sortBy, paramsObject) {
    paramsObject = Object.assign({limit: postLimit}, paramsObject)
    const params = new URLSearchParams(paramsObject)

    if (postFinishedLastLoad !== null) {
        if (postFinishedLastLoad.locked) {
            return false
        }
        await postFinishedLastLoad.acquireAwaitPromise()
    }
    postFinishedLastLoad = new PublicPromiseSingle()

    const postsUrl = `${localStorage.auth || DEFAULT_AUTH}/posts/?${params.toString()}`
    const res = await fetch(postsUrl)
    if (!res.ok) {
        console.error(`Failed to load top posts, status ${res.status} ${res.statusText}:`, await res.json())
        await finishPostLoadWithCd()
        return false
    }
    const postsObject = await res.json()
    for (const post of postsObject.posts) {
        const postDate = new Date(post.creationDate)
        const existingPost = postEls.getById(post.id)
        if (existingPost) { // Update the post with new data
            existingPost.fromPost(post)
        }
        else {
            const postEl = document.createElement("r-post")
            postEl.fromPost(post)
            if (hideSensitive && post.hasSensitiveContent) {
                postEl.hidden = true
            }
            let comparisonFn = null
            switch (sortBy) {
                case "beforeDate": {
                    comparisonFn = (a, b) => new Date(b.post.creationDate) - new Date(a.post.creationDate)
                    break
                }
                case "sinceDate": {
                    comparisonFn = (a, b) => new Date(a.post.creationDate) - new Date(b.post.creationDate)
                    break
                }
                case "beforeUpvotes": {
                    comparisonFn = (a, b) => b.post.upvotes - a.post.upvotes
                    break
                }
                case "sinceUpvotes": {
                    comparisonFn = (a, b) => a.post.upvotes - b.post.upvotes
                    break
                }
                default: {
                    await finishPostLoadWithCd()
                    return false
                }
            }
            const insertIndex = postEls.orderedInsert(postEl, comparisonFn)
            insertElementAtIndex(contents, postEl, contentsBaseLength + insertIndex)
        }
        if (sortBy === "beforeDate" || sortBy === "sinceDate") {
            if (postDate < bottomDate) {
                bottomDate = postDate
            }
            if (postDate > topDate) {
                topDate = postDate
            }
        }
        else if (sortBy === "beforeUpvotes" || sortBy === "sincecUpvotes") {
            if (post.upvotes < bottomUpvotes) {
                bottomUpvotes = post.upvotes
            }
            if (post.upvotes > topUpvotes) {
                topUpvotes = post.upvotes
            }
        }
    }

    await finishPostLoadWithCd()
    return true
}

// "date" - Most recent / "upvotes" - highest upvotes
async function tryLoadTopPosts() {
    if (filter == "date") {
        await tryLoadPosts("sinceDate", { sinceDate: topDate.toISOString() })
    }
    else if (filter == "upvotes") {
        await tryLoadPosts("sinceUpvotes", { sinceUpvotes: topUpvotes })
    }
}
// "date" - Most old, "votes" - lowest upvotes
async function tryLoadBottomPosts() {
    if (filter == "date") {
        await tryLoadPosts("beforeDate", { beforeDate: bottomDate.toISOString() })
    }
    else if (filter == "upvotes") {
        await tryLoadPosts("beforeUpvotes", { beforeUpvotes: bottomUpvotes })
    }
}
async function tryLoadKeywordPosts(keyword) {
    clearPosts()
    let sortBy = null
    let sortValue = null
    if (filter == "date") {
        sortBy = "beforeDate"
        sortValue = bottomDate.toISOString()
    }
    else if (filter == "upvotes") {
        sortBy = "beforeUpvotes"
        sortValue = bottomUpvotes
    }
    if (sortBy === null || sortValue === null) {
        return
    }
    await tryLoadPosts(sortBy, { [sortBy]: sortValue, keyword })
}
function clearPosts() {
    for (const postEl of postEls.items) {
        if (contents.contains(postEl)) {
            contents.removeChild(postEl)
        }
    }
    postEls.clear()
    topUpvotes = 0
    topDate = new Date(0)
    bottomUpvotes = 0xFFFFFFF
    bottomDate = new Date()
}
postsSortSelect.addEventListener("change", function() {
    filter = postsSortSelect.value
    clearPosts()
    tryLoadBottomPosts()
})
postsHideSensitive.addEventListener("change", function() {
    hideSensitive = !!postsHideSensitive.checked
    if (hideSensitive) {
        for (const postEl of postEls.items) {
            postEl.hidden = postEl.post.hasSensitiveContent
        }
    }
    else {
        for (const postEl of postEls.items) {
            postEl.hidden = false
        }
    }
})
