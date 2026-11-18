'use client';
export default function ConflictReview({local,latest,busy,onRead,onAdopt,onClose}:{local:unknown;latest:unknown;busy:boolean;onRead:()=>void;onAdopt:()=>void;onClose:()=>void}){
 return <div className="modal-backdrop" style={{zIndex:10000}}><section className="modal" style={{maxHeight:'85vh',overflowY:'auto'}} role="dialog" aria-modal="true" aria-label="并发修改核对">
  <h2>图谱已被其他操作更新</h2>
  <p>本次提交未保存。本地内容已保留；不会自动合并或再次提交。</p>
  <label>保留的本地提交<textarea aria-label="保留的本地提交" readOnly rows={6} value={JSON.stringify(local,null,2)}/></label>
  <button type="button" disabled={busy} onClick={onRead}>读取最新版本并核对</button>
  {latest!==undefined&&<><label>最新服务端内容<textarea aria-label="最新服务端内容" readOnly rows={8} value={JSON.stringify(latest,null,2)}/></label><p>核对后可切换到最新版本重新编辑。本地提交副本会继续保留，不会自动应用到新版本。</p><button type="button" disabled={busy} onClick={onAdopt}>已核对，使用最新版本重新编辑</button></>}
  <button type="button" disabled={busy} onClick={onClose}>返回原编辑</button>
 </section></div>;
}
