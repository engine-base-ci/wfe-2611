import { MockView } from "../render";

// K-190 の下絵のモックの 1 つの状態（/dev/mock/k190/<id>）
export default async function MockK190State({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div data-mock={id}>
      <MockView id={id} />
    </div>
  );
}
