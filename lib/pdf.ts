export const MAX_FILE_SIZE = 4 * 1024 * 1024;

export function validateLecture(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.type !== "application/pdf") {
    return { error: "Please upload a valid PDF lecture." } as const;
  }

  if (value.size > MAX_FILE_SIZE) {
    return { error: "The PDF must be 4 MB or smaller." } as const;
  }

  return { file: value } as const;
}

export async function pdfToGeminiPart(file: File) {
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");

  return {
    inline_data: {
      mime_type: "application/pdf" as const,
      data,
    },
  };
}
