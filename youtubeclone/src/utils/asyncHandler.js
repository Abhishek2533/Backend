// since we are using async await frequently so we make utilities in which we just pass out function and call this

// passing a function in function - higher order

const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next))
            .catch((err) => next(err))
    }
}


export default asyncHandler;



// try catch method -

// const asyncHandler = (fn) => async (req, res, next) => {
//     try {
//         await fn(req, res, next)
//     } catch (error) {
//         res.satus(error.code || 500).json({
//             success: false,
//             message: error.message
//         })
//     }
// } 