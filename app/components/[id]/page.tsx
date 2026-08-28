import ComponentForm from '@/components/ComponentForm';export default async function ComponentPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ComponentForm id={id}/>}
