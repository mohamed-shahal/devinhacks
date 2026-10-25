import { useEffect, useMemo, useState } from 'react';
import { Boxes, FileUp, Image, Search, Trash2 } from 'lucide-react';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  assetId,
  deleteAsset,
  getAssetBlob,
  listAssets,
  listProjects,
  saveAsset,
} from '../../state/storage';
import { useEditor } from '../../state/editor';
import type { AssetBlob } from '../../api/studio';
const imageTypes = ['image/png', 'image/jpeg', 'image/webp'];
async function readImage(file: File) {
  if (!imageTypes.includes(file.type) || file.size > 10_000_000)
    throw new Error('Choose a PNG, JPEG or WebP image under 10 MB.');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ok =
    file.type === 'image/png'
      ? bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10'
      : file.type === 'image/jpeg'
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.slice(0, 4).toString() === '82,73,70,70' &&
          String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!ok) throw new Error('Image signature does not match its file type.');
  const image = await createImageBitmap(file);
  if (image.width > 12000 || image.height > 12000) {
    image.close();
    throw new Error('Image dimensions must be at most 12,000 × 12,000.');
  }
  image.close();
}
async function readModel(file: File) {
  if (
    ![
      'model/gltf-binary',
      'model/gltf+json',
      'application/octet-stream',
      'application/json',
    ].includes(file.type) &&
    !file.name.match(/\.(glb|gltf)$/i)
  )
    throw new Error('Choose a GLB or GLTF model.');
  if (file.size > 50_000_000)
    throw new Error('3D files must be smaller than 50 MB.');
  const bytes = await file.arrayBuffer();
  const loader = new GLTFLoader();
  if (file.name.toLowerCase().endsWith('.glb')) {
    if (new DataView(bytes).getUint32(0, true) !== 0x46546c67)
      throw new Error('This GLB file has an invalid signature.');
  } else {
    const text = new TextDecoder().decode(bytes);
    const json = JSON.parse(text) as {
      buffers?: Array<{ uri?: string }>;
      images?: Array<{ uri?: string }>;
    };
    const refs = [...(json.buffers ?? []), ...(json.images ?? [])]
      .map((x) => x.uri)
      .filter((x): x is string => Boolean(x));
    if (refs.some((x) => !x.startsWith('data:')))
      throw new Error(
        'External files and URLs are blocked. Select a self-contained GLTF or package the model as GLB.',
      );
  }
  await loader.parseAsync(
    bytes,
    file.name.toLowerCase().endsWith('.gltf')
      ? new TextDecoder().decode(bytes)
      : '',
  );
}
export function Assets() {
  const [assets, setAssets] = useState<AssetBlob[]>([]),
    [filter, setFilter] = useState('all'),
    [query, setQuery] = useState(''),
    [status, setStatus] = useState('');
  const load = () =>
    void listAssets()
      .then(setAssets)
      .catch(() => setStatus('Browser storage is unavailable.'));
  useEffect(load, []);
  const visible = useMemo(
    () =>
      assets.filter(
        (a) =>
          (filter === 'all' ||
            (filter === 'images'
              ? a.mime.startsWith('image/')
              : a.mime.startsWith('model/'))) &&
          a.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [assets, filter, query],
  );
  async function upload(file?: File) {
    if (!file) return;
    try {
      if (file.type.startsWith('image/')) await readImage(file);
      else await readModel(file);
      const asset = {
        id: assetId(),
        name: file.name,
        mime:
          file.type ||
          (file.name.endsWith('.glb')
            ? 'model/gltf-binary'
            : 'model/gltf+json'),
        size: file.size,
        blob: file,
        createdAt: Date.now(),
      };
      await saveAsset(asset);
      await load();
      setStatus(`${file.name} validated and saved in this browser.`);
    } catch (e) {
      setStatus(
        e instanceof Error ? e.message : 'Asset could not be imported.',
      );
    }
  }
  async function selectReferenceImage(a: AssetBlob) {
    const record = await getAssetBlob(a.id);
    if (!record) return;
    sessionStorage.setItem('scenecraft:reference-image', a.id);
    window.dispatchEvent(
      new CustomEvent('scenecraft:reference-selected', { detail: a.id }),
    );
    setStatus(`${a.name} is ready to attach to a prompt in Studio.`);
  }
  async function remove(a: AssetBlob) {
    const [projects] = await Promise.all([listProjects()]);
    const editorState = useEditor.getState();
    const inActiveScene = [
      editorState.scene,
      ...editorState.past.map((snapshot) => snapshot.scene),
      ...editorState.future.map((snapshot) => snapshot.scene),
    ].some((scene) =>
      scene.objects.some((object) => object.properties.assetId === a.id),
    );
    const inSavedScene = projects.some((project) =>
      [
        project.scene,
        ...project.history.map((revision) => revision.scene),
      ].some((scene) =>
        scene.objects.some((object) => object.properties.assetId === a.id),
      ),
    );
    if (inActiveScene || inSavedScene) {
      setStatus(
        `“${a.name}” is used by a scene or saved revision. Remove its model object from every project and undo history before deleting the asset.`,
      );
      return;
    }
    if (window.confirm(`Delete ${a.name} from this browser?`)) {
      await deleteAsset(a.id);
      await load();
      setStatus(`${a.name} deleted from this browser.`);
    }
  }
  return (
    <>
      <div className="page-intro">
        <div>
          <p className="eyebrow">Images and local models</p>
          <h1>Assets</h1>
          <p>
            Validated files stay in this browser and never load from external
            URLs.
          </p>
        </div>
        <label className="button primary upload-button">
          <FileUp size={15} /> Import file
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,.glb,.gltf,model/gltf-binary,model/gltf+json"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </label>
      </div>
      <section className="content-panel assets-panel">
        <div className="asset-toolbar">
          <label className="search-box">
            <Search size={15} />
            <input
              aria-label="Search assets"
              placeholder="Search library"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter assets"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All files</option>
            <option value="images">Images</option>
            <option value="models">3D models</option>
          </select>
        </div>
        {visible.length ? (
          <div className="asset-grid">
            {visible.map((a) => (
              <article className="asset-card" key={a.id}>
                {a.mime.startsWith('image/') ? (
                  <img src={URL.createObjectURL(a.blob)} alt={a.name} />
                ) : (
                  <div className="asset-model-icon">
                    <Boxes size={32} />
                  </div>
                )}
                <div className="asset-info">
                  <strong title={a.name}>{a.name}</strong>
                  <small>
                    {a.mime} · {(a.size / 1024 / 1024).toFixed(2)} MB
                  </small>
                  <div>
                    {a.mime.startsWith('image/') && (
                      <button
                        className="button"
                        onClick={() => void selectReferenceImage(a)}
                      >
                        <Image size={13} /> Use as reference
                      </button>
                    )}
                    <button
                      className="icon-button danger"
                      aria-label={`Delete ${a.name}`}
                      onClick={() => void remove(a)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="assets-empty">
            <Boxes size={38} />
            <h2>Your local asset shelf is empty.</h2>
            <p>
              Import images or self-contained GLB/GLTF models. Size and file
              contents are checked before they enter the scene.
            </p>
            <label className="button primary upload-button">
              <FileUp size={15} /> Choose file
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,.glb,.gltf"
                onChange={(e) => void upload(e.target.files?.[0])}
              />
            </label>
          </div>
        )}
      </section>
      {status && (
        <div role="status" className="toast">
          {status}
          <button aria-label="Dismiss" onClick={() => setStatus('')}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
