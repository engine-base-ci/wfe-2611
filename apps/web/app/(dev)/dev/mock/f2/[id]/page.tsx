import { MockView } from "../mocks";

// 段 3 のモックの 1 つの状態（/dev/mock/f2/<id>）
export default async function MockF2State({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div data-mock={id}>
      <MockView id={id} />
    </div>
  );
}
