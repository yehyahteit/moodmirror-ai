import { createContext, useContext, useState } from 'react'

const ResultContext = createContext(null)

export function ResultProvider({ children }) {
  const [result, setResult] = useState(null)
  const [capturedImage, setCapturedImage] = useState(null) // data-url of the photo used
  return (
    <ResultContext.Provider value={{ result, setResult, capturedImage, setCapturedImage }}>
      {children}
    </ResultContext.Provider>
  )
}

export function useResult() {
  return useContext(ResultContext)
}
