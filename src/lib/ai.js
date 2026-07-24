import { supabase } from "./supabase.js";

/**
 * Send a rate con or receipt to the read-document edge function and get
 * structured data back. Images are downscaled first so scans stay fast
 * and cost a fraction of a cent.
 */
export async function readDocument(file) {
  const { media_type, data } = await prepareFile(file);
  const { data: result, error } = await supabase.functions.invoke("read-document", {
    body: { media_type, data },
  });
  if (error) throw new Error(friendly(error));
  if (result?.type === "error") throw new Error(result.reason || "The reader could not process this file.");
  return result;
}

async function prepareFile(file) {
  if (file.type === "application/pdf") {
    if (file.size > 8 * 1024 * 1024) throw new Error("That PDF is over 8 MB — too big to scan. Upload it for safekeeping and enter the data by hand.");
    return { media_type: "application/pdf", data: await toBase64(file) };
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Only photos and PDF files can be scanned.");
  }
  // Downscale big photos to max 1800px on the long edge, as JPEG.
  const img = await loadImage(file);
  const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  return { media_type: "image/jpeg", data: dataUrl.split(",")[1] };
}

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Could not read that file."));
    r.readAsDataURL(file);
  });
}

function loadImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Could not open that photo.")); };
    img.src = url;
  });
}

function friendly(error) {
  const msg = String(error?.message || error);
  if (msg.includes("Failed to send a request") || msg.includes("Failed to fetch"))
    return "Could not reach the document reader. Make sure the read-document function is deployed (see README) and you are online.";
  return msg;
}
