import React, { useEffect, useState, useCallback } from "react";
import {
  Button,
  Divider,
  Form,
  InputNumber,
  Modal,
  Table,
} from "antd";
import axios from "axios";
import { useSelector } from "react-redux";

const layout = {
  labelAlign: "left",
  labelCol: { span: 17 },
  wrapperCol: { span: 8 },
};

const ExhibitSetting = () => {
  const { userInfo } = useSelector((state) => state.auth);
  const { loading } = useSelector((state) => state.product);

  const [form] = Form.useForm();

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [addPrices, setAddPrices] = useState([]);
  const [amount, setAmount] = useState(null);
  const [editAmount, setEditAmount] = useState(false);

  // ============================================================================
  // API HELPERS
  // ============================================================================
  const api = axios.create({ baseURL: "/api/exhibit" });

  const fetchAddPrices = useCallback(async () => {
    const { data } = await api.get(`/addprice/${userInfo._id}`);
    setAddPrices(data.data || []);
  }, [userInfo]);

  const fetchAmount = useCallback(async () => {
    const { data } = await api.get(`/subquantity/${userInfo._id}`);
    setAmount(data.data?.[0] || null);
  }, [userInfo]);

  // ============================================================================
  // CRUD HANDLERS
  // ============================================================================
  const handleSavePrice = async (values) => {
    if (editItem) {
      await api.post("/addprice", {
        selectedAddPirce: editItem,
        data: values,
        userInfo,
      });
    } else {
      await api.post("/addprice/new", { data: values, userInfo });
    }

    setModalOpen(false);
    setEditItem(null);
    form.resetFields();
    fetchAddPrices();
  };

  const handleDeletePrice = async (item) => {
    await api.delete(`/addprice/${item._id}`);
    fetchAddPrices();
  };

  const handleUpdateAmount = async (values) => {
    await api.post("/subquantity", {
      payload: values,
      userInfo,
    });
    setEditAmount(false);
    fetchAmount();
  };

  // ============================================================================
  // TABLE CONFIG
  // ============================================================================
  const columns = [
    { title: "価格範囲", dataIndex: "price_scale" },
    { title: "追加の昇算価格", dataIndex: "odds_amount" },
    { title: "利益率", dataIndex: "bene_rate" },
    {
      title: "オプション",
      render: (_, record) => (
        <div className="flex gap-2">
          <Button
            ghost
            onClick={() => {
              setEditItem(record);
              form.setFieldsValue(record);
              setModalOpen(true);
            }}
          >
            変更
          </Button>
          <Button danger onClick={() => handleDeletePrice(record)}>
            削除
          </Button>
        </div>
      ),
    },
  ];

  // ============================================================================
  // EFFECTS
  // ============================================================================
  useEffect(() => {
    if (!userInfo?._id) return;
    fetchAddPrices();
    fetchAmount();
  }, [userInfo, fetchAddPrices, fetchAmount]);

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <section className="flex px-3 py-3 h-[92vh]">
      <div className="w-full card flex justify-center">
        <div className="flex flex-col gap-6 w-[500px]">

          {/* PRICE SETTINGS */}
          <div className="card p-6">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xl">販売価格設定</span>
              <Button
                type="primary"
                onClick={() => {
                  setEditItem(null);
                  form.resetFields();
                  setModalOpen(true);
                }}
              >
                設定内容追加
              </Button>
            </div>

            <Table
              columns={columns}
              dataSource={addPrices}
              pagination={false}
              rowKey="_id"
              size="small"
            />
          </div>

          {/* AMOUNT SETTINGS */}
          <div className="card p-6">
            <Form {...layout} onFinish={handleUpdateAmount}>
              <span className="text-xl">出品数量決定</span>
              <Divider />

              <Form.Item
                name="subquantity"
                label="数 量"
                initialValue={amount?.subquantity}
                rules={[{ required: true }]}
              >
                {editAmount ? (
                  <InputNumber min={0} className="w-full" />
                ) : (
                  <span>{amount?.subquantity}</span>
                )}
              </Form.Item>

              <Button
                htmlType={editAmount ? "submit" : "button"}
                onClick={() => setEditAmount(!editAmount)}
                className="w-full"
              >
                {editAmount ? "保 存" : "変 更"}
              </Button>
            </Form>
          </div>
        </div>
      </div>

      {/* MODAL */}
      <Modal
        open={modalOpen}
        footer={null}
        onCancel={() => {
          setModalOpen(false);
          setEditItem(null);
          form.resetFields();
        }}
      >
        <Form {...layout} form={form} onFinish={handleSavePrice}>
          <span className="text-xl">
            {editItem ? "設定内容変更" : "設定内容追加"}
          </span>
          <Divider />

          <Form.Item name="price_scale" label="次の価格より低い場合" rules={[{ required: true }]}>
            <InputNumber min={0} className="w-full" />
          </Form.Item>

          <Form.Item name="odds_amount" label="追加の昇算価格" rules={[{ required: true }]}>
            <InputNumber min={0} className="w-full" />
          </Form.Item>

          <Form.Item name="bene_rate" label="利益率" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} addonAfter="%" className="w-full" />
          </Form.Item>

          <Button loading={loading} htmlType="submit" className="w-full">
            {editItem ? "変 更" : "保 存"}
          </Button>
        </Form>
      </Modal>
    </section>
  );
};

export default ExhibitSetting;
